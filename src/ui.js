import catalog, { SLOT_LABELS } from "./catalog.js";
import { renderThumb } from "./faceTexture.js";
import { HAIR_IDS } from "./parts/hair.js";
import { applyPreset, applyColourBlock } from "./uiStyle.js";
import { initNameSave, initJsonTransfer, showSaved } from "./uiState.js";
import { BODY_TYPES } from "./state.js";
import { buildPosePanel } from "./uiPose.js";
import {
  el, cell64, pillRow, itemsFor, drawNum, colourGroup, buildRight,
} from "./uiWidgets.js";

// M2.5 UI redesign: left 3-col thumbnail grid + pixel pill title, right
// stacked colour groups, confirm + toast. All item data driven by catalog.
// M8: new BODY category (female/male body-type selector).

const EYE_COUNT = catalog.eyes;
const MOUTH_COUNT = catalog.mouths;
const SKIN_PRESETS = catalog.palettes.skin;
const HAIR_SWATCHES = [
  "#ffffff", "#222222", "#c0c0c0", "#8a5a3a", "#5a3a24",
  "#ffb3c7", "#c8f56b", "#9fd6ff", "#fff3a6", "#d9c2ff",
];
const CLOTH_SWATCHES = [
  "#ffffff", "#222222", "#e06060", "#3a5ca8", "#e8913a",
  "#ffb3c7", "#c8f56b", "#9fd6ff", "#fff3a6", "#d9c2ff",
];

// sections per cloth category: [slot, title]. Accessories tab shows all
// accessory slots.
const CLOTH_SECTIONS = {
  top: [["top", "TOP"], ["outer", "OUTER"]],
  bottom: [["bottom", "BOTTOM"]],
  shoes: [["socks", "SOCKS"], ["shoes", "SHOES"]],
  accessories: [
    ["headwear", "HEADWEAR"], ["eyewear", "EYEWEAR"], ["neck", "NECK"],
    ["wrist", "WRIST"], ["bag", "BAG"],
  ],
};

// STYLE.md section 7: the selection panel color follows the category
const CAT_COLORS = {
  face: "#9fd6ff", head: "#8fd8a8", body: "#f0a0b8", top: "#68b8e8",
  bottom: "#b088d8", shoes: "#f090c8", accessories: "#e8b060",
  pose: "#8fc8e8", style: "#e8d860",
};

export function createUI(state, uiHooks) {
  const onChange = uiHooks.onChange;
  const leftGrid = document.getElementById("leftGrid");
  const leftPillText = document.getElementById("leftPillText");
  const gridDots = document.getElementById("gridDots");
  const rightBody = document.getElementById("rightBody");
  const catBtns = [...document.querySelectorAll(".catBtn")];
  const hooks = {
    refresh: () => refresh(),
    onChange,
  };

  // name / confirm / toast wiring; returns nothing but mounts handlers once
  initNameSave({ state, onConfirm: () => showSaved() });
  // M7: JSON-file export/import (validated config via main.js onImport)
  initJsonTransfer({ state, onImport: uiHooks.onImport ?? (() => {}) });

  let refresh = () => {};
  let page = 0;

  function setPill(text) {
    leftPillText.textContent = text;
  }

  // ---- left 3-col grid ------------------------------------------------------
  // Show all entries when they fit the available height; otherwise page with
  // pixel prev/next arrows below (9 per page, 3x3). entries: [{ label, draw,
  // isActive, pick }]
  function buildGrid(entries, state, refreshAll) {
    leftGrid.replaceChildren();
    gridDots.replaceChildren();
    const rowH = 64 + 10; // cell + gap
    const panel = leftGrid.parentElement; // #leftPanel
    const pillH = panel.querySelector("#leftPill")?.offsetHeight ?? 40;
    const avail = (panel.clientHeight || 400) - pillH - 10 - 40; // gaps + padding
    const rows = Math.max(3, Math.floor(avail / rowH));
    const perPage = rows * 3;
    const pages = Math.max(1, Math.ceil(entries.length / perPage));
    if (page >= pages) page = pages - 1;
    const start = page * perPage;
    entries.slice(start, start + perPage).forEach((ei) => {
      const btn = el("button", "gridBtn", leftGrid);
      btn.title = ei.label ?? "";
      const c = cell64();
      btn.appendChild(c);
      ei.draw(c);
      btn.classList.toggle("active", !!ei.isActive());
      btn.addEventListener("click", () => {
        ei.pick();
        refreshAll();
        onChange();
      });
    });
    if (pages > 1) {
      const prev = el("button", "gridArrow", gridDots);
      prev.innerHTML = "&#9664;";
      prev.disabled = page === 0;
      prev.addEventListener("click", () => {
        page = Math.max(0, page - 1);
        rebuildCategory();
      });
      const dotWrap = el("span", "dotWrap", gridDots);
      for (let p = 0; p < pages; p++) {
        const dot = el("span", null, dotWrap);
        dot.classList.toggle("on", p === page);
        dot.addEventListener("click", () => {
          page = p;
          rebuildCategory();
        });
      }
      const next = el("button", "gridArrow", gridDots);
      next.innerHTML = "&#9654;";
      next.disabled = page === pages - 1;
      next.addEventListener("click", () => {
        page = Math.min(pages - 1, page + 1);
        rebuildCategory();
      });
    }
  }

  // ---- face panel -----------------------------------------------------------
  function buildFace() {
    setPill("EYES");
    const faceEntries = [];
    for (let i = 1; i <= EYE_COUNT; i++) {
      faceEntries.push({
        label: `eyes ${i}`,
        draw: (c) => renderThumb(c, { ...state, mouth: 0, eyes: i }),
        isActive: () => state.eyes === i,
        pick: () => (state.eyes = i),
      });
    }
    for (let i = 1; i <= MOUTH_COUNT; i++) {
      faceEntries.push({
        label: `mouth ${i}`,
        draw: (c) => renderThumb(c, { ...state, eyes: 0, mouth: i }),
        isActive: () => state.mouth === i,
        pick: () => (state.mouth = i),
      });
    }
    const syncRight = buildRight(rightBody, [
      { title: "SKIN TONE", key: "skin", owner: state, swatches: SKIN_PRESETS },
    ], hooks);
    // thunk: resolve the CURRENT panel refresh when a grid item is picked
    // (a captured function would rebuild the previous panel -> random jumps)
    const syncLeft = () => buildGrid(faceEntries, state, () => refresh());
    syncLeft();
    syncRight();
    rebuildCurrent = () => {
      syncLeft();
      syncRight();
    };
    refresh = () => {
      syncLeft();
      syncRight();
    };
  }

  // ---- hair panel -----------------------------------------------------------
  function buildHead() {
    setPill("HAIR STYLE");
    const entries = [{
      label: "none",
      draw: (c) => {
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fffdfa";
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = "#906020";
        ctx.fillRect(26, 26, 12, 12);
      },
      isActive: () => !state.hair.id,
      pick: () => (state.hair.id = null),
    }];
    HAIR_IDS.forEach((id) => {
      entries.push({
        label: id,
        draw: (c) => drawHairThumb(c, id, state.hair.color),
        isActive: () => state.hair.id === id,
        pick: () => (state.hair.id = id),
      });
    });
    const syncRight = buildRight(rightBody, [
      { title: "SKIN TONE", key: "skin", owner: state, swatches: SKIN_PRESETS },
      { title: "HAIR COLOR", key: "color", owner: state.hair, swatches: HAIR_SWATCHES },
    ], hooks);
    const syncLeft = () => buildGrid(entries, state, () => refresh());
    syncLeft();
    syncRight();
    rebuildCurrent = () => {
      syncLeft();
      syncRight();
    };
    refresh = () => {
      syncLeft();
      syncRight();
    };
  }

  // hair icon thumbs: big pixel number per style id (like the ref-hair UI)
  function drawHairThumb(c, id, color) {
    const n = Number(id.slice(5)) || 0;
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#fffdfa";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 64, 14);
    drawNum(ctx, n || 0, "#38220c");
  }

  // ---- cloth panels / accessories -------------------------------------------
  // accessories: one sub-pill row per slot (HEADWEAR/EYEWEAR/...) so the grid
  // shows only the active section, not everything at once
  function buildCloth(cat) {
    const sections = CLOTH_SECTIONS[cat];
    let activeSection = sections[0][0];
    setPill(SLOT_PILL[activeSection] ?? sections[0][1]);

    function buildSubPills() {
      const old = document.getElementById("subPills");
      if (old) old.remove();
      if (sections.length < 2) return;
      const bar = el("div", "subPillBar");
      bar.id = "subPills";
      // insert between pill title and grid inside #leftPanel
      document.getElementById("leftPanel").insertBefore(
        bar, document.getElementById("leftGrid")
      );
      sections.forEach(([slot, title]) => {
        const b = el("button", "subPill", bar);
        b.textContent = title;
        b.classList.toggle("activeSection", activeSection === slot);
        b.addEventListener("click", () => {
          activeSection = slot;
          rebuildCurrent();
        });
      });
    }

    const renderRight = () => {
      rightBody.replaceChildren();
      const syncs = [];
      const slot = activeSection;
      const title = sections.find(([s]) => s === slot)[1];
      const colors = state[slot]?.colors;
      if (colors) {
        const slots = catalog.items.find((i) => i.id === state[slot].id)
          ?.colorSlots ?? ["main"];
        slots.forEach((cs) => {
          const label = `${title} ${cs === "main" ? "COLOR" : cs.toUpperCase()}`;
          syncs.push(colourGroup(rightBody, label, cs, colors, CLOTH_SWATCHES, hooks));
        });
      }
      const syncRight = () => syncs.forEach((s) => s.sync());
      syncRight();
      refresh = () => syncRight();
    };

    const renderGrid = () => {
      const [slot, title] = sections.find(([s]) => s === activeSection);
      setPill(title);
      const entries = [{
        label: `${title}: none`,
        draw: (c) => {
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#fffdfa";
          ctx.fillRect(0, 0, 64, 64);
          ctx.fillStyle = "#e0c090";
          ctx.fillRect(0, 0, 64, 14);
          drawNum(ctx, 0, "#38220c");
        },
        isActive: () => !state[slot],
        pick: () => (state[slot] = null),
      }];
      itemsFor(slot).forEach((item, i) => {
        entries.push({
          label: item.label,
          draw: (c) => drawItemThumb(c, item, i + 1),
          isActive: () => state[slot]?.id === item.id,
          pick: () => pickCloth(slot, item),
        });
      });
      buildGrid(entries, state, () => refresh());
      renderRight();
    };

    rebuildCurrent = () => {
      buildSubPills();
      renderGrid();
    };
    rebuildCurrent();
  }

  function pickCloth(slot, item) {
    const prev = state[slot]?.colors ?? {};
    state[slot] = { id: item.id, colors: {} };
    for (const cs of item.colorSlots) {
      state[slot].colors[cs] = prev[cs] ?? (cs === "main" ? "#ffffff" : "#222222");
    }
    state[slot].colors.secondaryFollow
      = item.colorSlots.includes("secondary");
    setPill(SLOT_PILL[slot] ?? SLOT_LABELS[slot] ?? slot.toUpperCase());
    rebuildCurrent();
  }

  let rebuildCurrent = () => {};

  // thumbnails: big number tile (ref style); face tab keeps face thumbs

  function drawItemThumb(c, item, n) {
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#fffdfa";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#e0c090";
    ctx.fillRect(0, 0, 64, 14);
    drawNum(ctx, n, "#38220c");
  }

  // ---- body panel (M8 body-type selector) ------------------------------------
  // two round thumbnail buttons: female hourglass silhouette / male straight
  // rectangle silhouette. Selecting rebuilds the character via onChange().
  function drawBodyThumb(c, type) {
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#fffdfa";
    ctx.fillRect(0, 0, 64, 64);
    ctx.fillStyle = "#f07890";
    ctx.fillRect(0, 0, 64, 14);
    ctx.fillStyle = "#38220c";
    if (type === "male") {
      ctx.fillRect(10, 20, 44, 10);  // broad straight chest
      ctx.fillRect(14, 30, 36, 26);
    } else {
      ctx.fillRect(16, 20, 32, 8);  // hourglass: shoulders -> waist -> hips
      ctx.fillRect(22, 28, 20, 10);
      ctx.fillRect(12, 38, 40, 14);
    }
  }

  function buildBody() {
    setPill("BODY");
    const entries = BODY_TYPES.map((id) => ({
      label: id === "female" ? "Female" : "Male",
      draw: (c) => drawBodyThumb(c, id),
      isActive: () => (state.body ?? "female") === id,
      pick: () => (state.body = id),
    }));
    const syncLeft = () => buildGrid(entries, state, () => refresh());
    syncLeft();
    rightBody.replaceChildren();
    pillRow(rightBody, "BODY TYPE", true);
    rebuildCurrent = syncLeft;
    refresh = syncLeft;
  }

  // ---- style panel -----------------------------------------------------------
  const SLOT_PILL = {
    face: "FACE", head: "HAIR STYLE", body: "BODY", top: "TOP",
    bottom: "BOTTOM", shoes: "SHOES", accessories: "ACCESSORIES",
    style: "STYLE",
  };

  function buildStylePanel() {
    setPill("STYLE");
    const presets = catalog.presets;
    let last = null;
    const entries = presets.map((preset, i) => ({
      label: preset.label,
      draw: (c) => {
        const ctx = c.getContext("2d");
        ctx.imageSmoothingEnabled = false;
        ctx.fillStyle = "#fffdfa";
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = "#e8a80c";
        ctx.fillRect(0, 0, 64, 14);
        // preset name in two lines of readable pixel text
        ctx.fillStyle = "#38220c";
        ctx.font = "8px 'Press Start 2P', monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const words = preset.label.toUpperCase().split(" ");
        const line1 = words.slice(0, Math.ceil(words.length / 2)).join(" ");
        const line2 = words.slice(Math.ceil(words.length / 2)).join(" ");
        if (line2) {
          ctx.fillText(line1, 32, 30);
          ctx.fillText(line2, 32, 46);
        } else {
          ctx.fillText(line1, 32, 38);
        }
      },
      isActive: () => last === i,
      pick: () => {
        applyPreset(preset, state, onChange);
        last = i;
      },
    }));
    entries.push({
      label: "auto colour-block",
      draw: (c) => {
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fffdfa";
        ctx.fillRect(0, 0, 64, 64);
        const grd = ["#e06060", "#3a5ca8", "#e8913a"];
        grd.forEach((cc, i) => {
          ctx.fillStyle = cc;
          ctx.fillRect(10 + i * 16, 20, 12, 24);
        });
      },
      isActive: () => false,
      pick: () => applyColourBlock(state, onChange, null),
    });
    const syncLeft = () => buildGrid(entries, state, () => refresh());
    syncLeft();
    rightBody.replaceChildren();
    pillRow(rightBody, "STYLE PACKS", true);
    refresh = () => syncLeft();
  }

  const BUILDERS = {
    face: buildFace,
    head: buildHead,
    body: buildBody,
    top: () => buildCloth("top"),
    bottom: () => buildCloth("bottom"),
    shoes: () => buildCloth("shoes"),
    accessories: () => buildCloth("accessories"),
    // M6.5 pose tab: preset grid + manual sliders (built in uiPose.js)
    pose: () => buildPosePanel({ state, onChange, setPill, buildGrid }),
    style: () => buildStylePanel(),
  };

  let current = null;

  function rebuildCategory() {
    // clear any per-category sub-pill bar before rebuilding
    document.getElementById("subPills")?.remove();
    BUILDERS[current]?.();
    // M7 comparison fix: panel colour follows the category (STYLE.md section 7).
    // The tint wraps the pill + grid cards (like the mockup), not the empty
    // column below, so a short grid never leaves a floating colour block.
    const tint = CAT_COLORS[current] ?? "";
    for (const id of ["leftPill", "leftGrid"])
      document.getElementById(id).style.background = tint || "";
  }

  function switchCat(cat) {
    if (cat === current) return;
    current = cat;
    page = 0;
    catBtns.forEach((b) =>
      b.classList.toggle("active", b.dataset.cat === cat)
    );
    rebuildCategory();
  }

  catBtns.forEach((b) =>
    b.addEventListener("click", () => switchCat(b.dataset.cat))
  );
  const startCat = new URLSearchParams(location.search).get("cat");
  switchCat(startCat && BUILDERS[startCat] ? startCat : "head");

  return { switchCat };
}
