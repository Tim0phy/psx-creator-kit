import catalog, { SLOT_LABELS } from "./catalog.js";
import { renderThumb } from "./faceTexture.js";
import { HAIR_IDS } from "./parts/hair.js";
import { applyPreset, applyColourBlock } from "./uiStyle.js";
import { initNameSave, showSaved } from "./uiState.js";

// M2.5 UI redesign: left 3-col thumbnail grid + pixel pill title, right
// stacked colour groups, confirm + toast. All item data driven by catalog.

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

const $ = (id) => document.getElementById(id);

function itemsFor(slot) {
  return catalog.items.filter((i) => i.slot === slot);
}

function el(tag, cls, parent) {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (parent) parent.appendChild(d);
  return d;
}

function cell64() {
  // 64x64 offscreen thumbnail cache (per grid cell), pixelated display
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  return cv;
}

function pillRow(parent, text, withStars) {
  const pill = el("div", withStars ? "rightPill" : "void", parent);
  if (withStars) {
    el("span", "pillStar", pill);
    const t = el("span", null, pill);
    t.textContent = text;
    el("span", "pillStar", pill);
  } else {
    pill.textContent = text;
  }
  return pill;
}

export function createUI(state, { onChange }) {
  const leftGrid = $("leftGrid");
  const leftPillText = $("leftPillText");
  const gridDots = $("gridDots");
  const rightBody = $("rightBody");
  const catBtns = [...document.querySelectorAll(".catBtn")];

  // name / confirm / toast wiring; returns nothing but mounts handlers once
  initNameSave({ onConfirm: () => showSaved() });

  let refresh = () => {};
  let page = 0;

  function setPill(text) {
    leftPillText.textContent = text;
  }

  function sectionLabel(text, parent = rightBody) {
    const d = el("div", "sectionLabel", parent);
    d.textContent = text;
  }

  // ---- left 3-col grid ------------------------------------------------------
  // entries: [{ key, label, draw(c64) }] rendered per active category; pages
  // of 9 with pixel dots below when > 9. Rebuild once per switchCat; label-only
  function buildGrid(entries, state, refreshAll) {
    leftGrid.replaceChildren();
    gridDots.replaceChildren();
    const pages = Math.max(1, Math.ceil(entries.length / 9));
    if (page >= pages) page = pages - 1;
    const start = page * 9;
    entries.slice(start, start + 9).forEach((ei, i) => {
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
      btn._idx = start + i;
    });
    if (pages > 1) {
      for (let p = 0; p < pages; p++) {
        const dot = el("span", null, gridDots);
        dot.classList.toggle("on", p === page);
        dot.addEventListener("click", () => {
          page = p;
          rebuildCategory();
        });
      }
    }
  }

  // ---- right colour groups --------------------------------------------------
  function colourGroup(title, key, ownerObj, swatches) {
    const grp = el("div", "colorGroup", rightBody);
    pillRow(grp, title, true);
    const row = el("div", "swatchRow", grp);
    const btns = swatches.map((hex) => {
      const b = el("button", "swatchBtn", row);
      b.dataset.sw = `${key}:${hex.toLowerCase()}`;
      b.style.background = hex;
      b.title = hex;
      b.addEventListener("click", () => setColor(hex));
      return b;
    });
    const custom = el("input", "customSkin", row);
    custom.type = "color";
    custom.value = ownerObj[key];
    custom.title = "custom colour";
    custom.addEventListener("input", () => setColor(custom.value));
    function setColor(hex) {
      ownerObj[key] = hex;
      if (key === "secondary") ownerObj.secondaryFollow = false;
      custom.value = hex;
      refresh();
      onChange();
    }
    return {
      sync: () => {
        btns.forEach((b) =>
          b.classList.toggle(
            "active",
            b.dataset.sw === `${key}:${ownerObj[key]?.toLowerCase()}`
          )
        );
        custom.value = ownerObj[key];
      },
    };
  }

  // rebuild the whole right column synchronised with current state
  function buildRight(groups) {
    rightBody.replaceChildren();
    const syncs = groups.map(({ title, key, owner, swatches }) =>
      colourGroup(title, key, owner, swatches)
    );
    return () => syncs.forEach((s) => s.sync());
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
    const syncRight = buildRight([
      { title: "SKIN TONE", key: "skin", owner: state, swatches: SKIN_PRESETS },
    ]);
    const syncLeft = () => buildGrid(faceEntries, state, refresh);
    syncLeft();
    syncRight();
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
    const syncRight = buildRight([
      { title: "SKIN TONE", key: "skin", owner: state, swatches: SKIN_PRESETS },
      { title: "HAIR COLOR", key: "color", owner: state.hair, swatches: HAIR_SWATCHES },
    ]);
    const syncLeft = () => buildGrid(entries, state, refresh);
    syncLeft();
    syncRight();
    refresh = () => {
      syncLeft();
      syncRight();
    };
  }

  // hair icon thumbs: original pixel-art style head silhouette per style id
  function drawHairThumb(c, id, color) {
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#fffdfa";
    ctx.fillRect(0, 0, 64, 64);
    const n = Number(id.slice(5)) || 0;
    ctx.fillStyle = color;
    // original silhouettes per hair id, all procedural
    if (n === 1) { ctx.fillRect(14, 18, 36, 20); ctx.fillRect(18, 34, 28, 8); }
    else if (n === 2) { ctx.fillRect(12, 16, 40, 22); ctx.fillRect(8, 24, 10, 30); ctx.fillRect(46, 24, 10, 30); }
    else if (n === 3) { ctx.fillRect(12, 16, 40, 18); ctx.fillRect(4, 14, 10, 34); ctx.fillRect(50, 14, 10, 34); }
    else if (n === 4) { ctx.fillRect(12, 16, 40, 20); ctx.fillRect(46, 26, 14, 26); }
    else if (n === 5) { ctx.fillRect(16, 20, 32, 14); ctx.fillRect(24, 8, 16, 14); }
    else if (n === 6) { ctx.fillRect(14, 14, 36, 18); ctx.fillRect(12, 8, 8, 12); ctx.fillRect(24, 4, 8, 14); ctx.fillRect(36, 4, 8, 14); ctx.fillRect(46, 8, 8, 12); }
    else if (n === 7) { ctx.fillRect(12, 16, 40, 20); ctx.fillRect(6, 22, 10, 40); ctx.fillRect(48, 22, 10, 40); }
    else if (n === 8) { ctx.fillRect(16, 20, 32, 12); }
    else if (n === 9) { ctx.fillRect(12, 16, 40, 20); ctx.fillRect(22, 34, 20, 22); }
    else if (n === 10) { ctx.fillRect(12, 16, 40, 18); ctx.fillRect(10, 14, 18, 10); }
    else if (n === 11) { ctx.fillRect(12, 16, 40, 18); ctx.fillRect(14, 18, 16, 30); }
    // face
    ctx.fillStyle = "#f5d5bf";
    ctx.fillRect(18, 24, 28, 26);
    ctx.fillStyle = "#26221e";
    ctx.fillRect(24, 32, 4, 6);
    ctx.fillRect(36, 32, 4, 6);
  }

  // ---- cloth panels / accessories -------------------------------------------
  function clothStateIn(slot) {
    return state[slot];
  }

  function buildCloth(cat) {
    const sections = CLOTH_SECTIONS[cat];
    let firstSectionTitle = sections[0][1];
    setPill(firstSectionTitle);
    const perSection = () => {
      rightBody.replaceChildren();
      const syncs = [];
      sections.forEach(([slot, title]) => {
        const colors = state[slot]?.colors;
        if (colors) {
          const slots = catalog.items.find((i) => i.id === state[slot].id)
            ?.colorSlots ?? ["main"];
          slots.forEach((cs, ci) => {
            const label = `${title} ${cs === "main" ? "COLOR" : cs.toUpperCase()}`
            syncs.push(colourGroup(label, cs, colors, CLOTH_SWATCHES));
            if (ci === 0) setPill(`ITEM COLOR`);
          });
        }
      });
      const syncRight = () => syncs.forEach((s) => s.sync());
      syncRight();
      refresh = () => syncRight();
    };
    buildClothGrid(cat, sections, perSection);
  }

  function buildClothGrid(cat, sections, rebuildRight) {
    const entries = [];
    sections.forEach(([slot, title]) => {
      entries.push({
        label: `${title}: none`,
        draw: (c) => {
          const ctx = c.getContext("2d");
          ctx.fillStyle = "#fffdfa";
          ctx.fillRect(0, 0, 64, 64);
          ctx.fillStyle = "#906020";
          ctx.fillRect(26, 26, 12, 12);
        },
        isActive: () => !state[slot],
        pick: () => (state[slot] = null),
      });
      itemsFor(slot).forEach((item) => {
        entries.push({
          label: item.label,
          draw: (c) => drawItemThumb(c, item, state, slot),
          isActive: () => state[slot]?.id === item.id,
          pick: () => pickCloth(slot, item),
        });
      });
    });
    buildGrid(entries, state, refresh);
    rebuildRight();
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

  // thumbnails: draw simple item-labelled swatch once and cache by id
  const thumbCache = new Map();

  function drawItemThumb(c, item, state, slot) {
    const key = `${item.id}:${state[slot]?.colors?.main ?? ""}`;
    let tiles = thumbCache.get(item.id);
    if (!tiles) {
      tiles = { color: null };
      thumbCache.set(item.id, tiles);
    }
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#fffdfa";
    ctx.fillRect(0, 0, 64, 64);
    // stylised wireframe square + item letter block (original idle icon)
    const mainColor = state[slot]?.colors?.main ?? "#e06060";
    ctx.fillStyle = mainColor;
    ctx.fillRect(14, 14, 36, 36);
    ctx.strokeStyle = "#906020";
    ctx.lineWidth = 3;
    ctx.strokeRect(14, 14, 36, 36);
    ctx.fillStyle = "#26221e";
    ctx.font = "12px monospace";
    ctx.textAlign = "center";
    ctx.fillText(item.label[0].toUpperCase(), 32, 52);
  }

  // ---- style panel -----------------------------------------------------------
  const SLOT_PILL = {
    face: "FACE", head: "HAIR STYLE", top: "TOP", bottom: "BOTTOM",
    shoes: "SHOES", accessories: "ACCESSORIES", style: "STYLE",
  };

  function buildStylePanel() {
    setPill("STYLE");
    const presets = catalog.presets;
    let last = null;
    const entries = presets.map((preset, i) => ({
      label: preset.label,
      draw: (c) => {
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fffdfa";
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = "#e8a80c";
        ctx.font = "12px monospace";
        ctx.textAlign = "center";
        ctx.fillText(String(i + 1), 32, 20);
        ctx.fillStyle = "#906020";
        ctx.font = "6px monospace";
        ctx.fillText(preset.label.slice(0, 6).toUpperCase(), 32, 44);
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
    const syncLeft = () => buildGrid(entries, state, refresh);
    syncLeft();
    rightBody.replaceChildren();
    pillRow(rightBody, "STYLE PACKS", true);
    refresh = () => syncLeft();
  }

  const BUILDERS = {
    face: buildFace,
    head: buildHead,
    top: () => buildCloth("top"),
    bottom: () => buildCloth("bottom"),
    shoes: () => buildCloth("shoes"),
    accessories: () => buildCloth("accessories"),
    style: () => buildStylePanel(),
  };

  let current = null;

  function rebuildCategory() {
    BUILDERS[current]?.();
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
