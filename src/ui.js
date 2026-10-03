import catalog, { SLOT_LABELS } from "./catalog.js";
import { renderThumb } from "./faceTexture.js";
import { HAIR_IDS } from "./parts/hair.js";
import { applyPreset, applyColourBlock } from "./uiStyle.js";
import { initNameSave, showSaved } from "./uiState.js";

// M2.5 UI redesign, matched to ui-psx-mockup.png:
// left = 3-col item grid (numbers, eyes use texture thumbs) + pill title with
// pixel stars; right = SKIN TONE + active category colour groups.
// All item data driven by catalog.json.

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

const CAT_PILL = {
  face: "FACE", head: "HAIR STYLE", top: "TOP", bottom: "BOTTOM",
  shoes: "SHOES", accessories: "ACCESSORIES", style: "STYLE",
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

export function createUI(state, { onChange }) {
  const leftGrid = $("leftGrid");
  const leftPillText = $("leftPillText");
  const gridDots = $("gridDots");
  const rightBody = $("rightBody");
  const catBtns = [...document.querySelectorAll(".catBtn")];

  initNameSave({ onConfirm: () => showSaved() });

  let refresh = () => {};
  let page = 0;
  let current = null;

  function setPill(text) {
    leftPillText.textContent = text;
  }

  // ---- left 3-col grid: pages of 9, pixel dots below -------------------------
  function buildGrid(entries) {
    leftGrid.replaceChildren();
    gridDots.replaceChildren();
    const pages = Math.max(1, Math.ceil(entries.length / 9));
    if (page >= pages) page = pages - 1;
    const start = page * 9;
    entries.slice(start, start + 9).forEach((ei) => {
      const btn = el("button", "gridBtn", leftGrid);
      btn.title = ei.label ?? "";
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      btn.appendChild(c);
      ei.draw(c);
      btn.classList.toggle("active", !!ei.is());
      btn.addEventListener("click", () => {
        ei.pick();
        refresh();
        onChange();
      });
    });
    for (let p = 0; p < pages; p++) {
      const span = el("span", null, gridDots);
      span.classList.toggle("on", p === page);
      if (pages > 1) {
        span.addEventListener("click", () => {
          page = p;
          rebuildCategory();
        });
      }
    }
  }

  function drawNumThumb(c, num, active, color = "#906020") {
    // mockup-style icon tile: dark number on cream square
    const ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#fffdfa";
    ctx.fillRect(0, 0, 64, 64);
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.strokeRect(6, 6, 52, 52);
    ctx.fillStyle = active ? "#906020" : "#38220c";
    ctx.font = "28px 'Press Start 2P', monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(num, 32, 34);
  }

  // ---- right colour groups ---------------------------------------------------
  function colourGroup(title, ownerObj, swatches) {
    const grp = el("div", "colorGroup", rightBody);
    const pill = el("div", "rightPill", grp);
    el("span", "pillStar", pill);
    const t = el("span", null, pill);
    t.textContent = title;
    el("span", "pillStar", pill);
    const row = el("div", "swatchRow", grp);
    const btns = swatches.map((hex) => {
      const b = el("button", "swatchBtn", row);
      b.dataset.sw = hex.toLowerCase();
      b.style.background = hex;
      b.title = hex;
      return b;
    });
    const custom = el("input", "customSkin", row);
    custom.type = "color";
    custom.title = "custom colour";
    return {
      grp,
      sync(val, set) {
        btns.forEach((b) => {
          b.classList.toggle("active", b.dataset.sw === val?.toLowerCase());
          b.onclick = () => set(b.dataset.sw);
        });
        custom.value = val;
        custom.oninput = () => set(custom.value);
      },
    };
  }

  // returns sync() that re-reads state each refresh
  function buildRight(groups) {
    rightBody.replaceChildren();
    return () => {
      rightBody.replaceChildren();
      const rows = groups.map(({ title, get, set, swatches }) => {
        const g = colourGroup(title, null, swatches);
        // colourGroup appended into rightBody already; re-owner
        g.sync(get(), set);
        return g;
      });
      return rows;
    };
  }

  // skin group is always first (mockup)
  function skinGroup() {
    return {
      title: "SKIN TONE",
      get: () => state.skin,
      set: (hex) => (state.skin = hex),
      swatches: SKIN_PRESETS,
    };
  }

  // ---- FACE -------------------------------------------------------------------
  function buildFace() {
    const entries = [];
    for (let i = 1; i <= EYE_COUNT; i++) {
      entries.push({
        label: `eyes ${i}`,
        draw: (c) => renderThumb(c, { ...state, mouth: 0, eyes: i }),
        is: () => state.eyes === i,
        pick: () => (state.eyes = i),
      });
    }
    for (let i = 1; i <= MOUTH_COUNT; i++) {
      entries.push({
        label: `mouth ${i}`,
        draw: (c) => drawNumThumb(c, String(i), false, "#b87830"),
        is: () => state.mouth === i,
        pick: () => (state.mouth = i),
      });
    }
    // blush toggle chip (small extra action, keeps face panel complete)
    entries.push({
      label: "blush",
      draw: (c) => {
        const ctx = c.getContext("2d");
        ctx.fillStyle = "#fffdfa";
        ctx.fillRect(0, 0, 64, 64);
        ctx.fillStyle = "#f2a2ac";
        ctx.beginPath();
        ctx.arc(20, 40, 7, 0, Math.PI * 2);
        ctx.arc(44, 40, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#38220c";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText("BLUSH", 32, 24);
      },
      is: () => state.blush,
      pick: () => (state.blush = !state.blush),
    });
    const right = [skinGroup()];
    const syncLeft = () => buildGrid(entries);
    const syncRight = () => {
      rightBody.replaceChildren();
      const g = colourGroup(right[0].title, null, right[0].swatches);
      g.sync(right[0].get(), right[0].set);
    };
    syncLeft();
    syncRight();
    refresh = () => {
      syncLeft();
      syncRight();
    };
  }

  // ---- HAIR -------------------------------------------------------------------
  function buildHead() {
    const entries = [{
      label: "none",
      draw: (c) => drawNumThumb(c, "Ø", false),
      is: () => !state.hair.id,
      pick: () => (state.hair.id = null),
    }];
    HAIR_IDS.forEach((id) => {
      entries.push({
        label: id,
        draw: (c) => drawNumThumb(c, String(HAIR_IDS.indexOf(id) + 1), false),
        is: () => state.hair.id === id,
        pick: () => (state.hair.id = id),
      });
    });
    const syncLeft = () => buildGrid(entries);
    const syncRight = () => {
      rightBody.replaceChildren();
      const skin = colourGroup("SKIN TONE", null, SKIN_PRESETS);
      skin.sync(state.skin, (hex) => (state.skin = hex));
      const hair = colourGroup("HAIR COLOR", null, HAIR_SWATCHES);
      hair.sync(state.hair.color, (hex) => {
        state.hair.color = hex;
        refresh();
        onChange();
      });
    };
    syncLeft();
    syncRight();
    refresh = () => {
      syncLeft();
      syncRight();
    };
  }

  // ---- cloth + accessories ----------------------------------------------------
  function pickCloth(slot, item) {
    const prev = state[slot]?.colors ?? {};
    state[slot] = { id: item.id, colors: {} };
    for (const cs of item.colorSlots) {
      state[slot].colors[cs] =
        prev[cs] ?? (cs === "main" ? "#ffffff" : "#222222");
    }
    state[slot].colors.secondaryFollow = item.colorSlots.includes("secondary");
  }

  function buildCloth(cat) {
    const sections = CLOTH_SECTIONS[cat];
    const entries = [];
    sections.forEach(([slot, title]) => {
      entries.push({
        label: `${title}: none`,
        draw: (c) => drawNumThumb(c, "Ø", false),
        is: () => !state[slot],
        pick: () => (state[slot] = null),
      });
      itemsFor(slot).forEach((item) => {
        entries.push({
          label: item.label,
          draw: (c) =>
            drawNumThumb(c, String(itemsFor(slot).indexOf(item) + 1), false),
          is: () => state[slot]?.id === item.id,
          pick: () => pickCloth(slot, item),
        });
      });
    });
    const syncLeft = () => buildGrid(entries);
    const syncRight = () => {
      rightBody.replaceChildren();
      const skin = colourGroup("SKIN TONE", null, SKIN_PRESETS);
      skin.sync(state.skin, (hex) => (state.skin = hex));
      sections.forEach(([slot, title]) => {
        const colors = state[slot]?.colors;
        if (!colors) return;
        const slots = catalog.items.find((i) => i.id === state[slot].id)
          ?.colorSlots ?? ["main"];
        slots.forEach((cs) => {
          const label =
            cs === "main" ? `${title} COLOR` : `${title} ${cs.toUpperCase()}`;
          const follow = cs === "secondary" && colors.secondaryFollow !== false;
          if (follow) colors.secondary = colors.main;
          const g = colourGroup(label, null, CLOTH_SWATCHES);
          g.sync(colors[cs], (hex) => {
            colors[cs] = hex;
            if (cs === "secondary") colors.secondaryFollow = false;
            refresh();
            onChange();
          });
        });
      });
    };
    syncLeft();
    syncRight();
    refresh = () => {
      syncLeft();
      syncRight();
    };
  }

  // ---- STYLE presets ----------------------------------------------------------
  function buildStylePanel() {
    const presets = catalog.presets;
    let last = null;
    const entries = presets.map((preset, i) => ({
      label: preset.label,
      draw: (c) => drawNumThumb(c, String(i + 1), false, "#e8a80c"),
      is: () => last === i,
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
        ["#e06060", "#3a5ca8", "#e8913a"].forEach((cc, i) => {
          ctx.fillStyle = cc;
          ctx.fillRect(10 + i * 16, 20, 12, 24);
        });
      },
      is: () => false,
      pick: () => applyColourBlock(state, onChange, null),
    });
    const syncLeft = () => buildGrid(entries);
    const syncRight = () => {
      rightBody.replaceChildren();
      const pill = el("div", "rightPill", rightBody);
      el("span", "pillStar", pill);
      const t = el("span", null, pill);
      t.textContent = "STYLE PACKS";
      el("span", "pillStar", pill);
    };
    syncLeft();
    syncRight();
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

  function rebuildCategory() {
    leftPillText.textContent = CAT_PILL[current] ?? current.toUpperCase();
    BUILDERS[current]?.();
  }

  function switchCat(cat) {
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
