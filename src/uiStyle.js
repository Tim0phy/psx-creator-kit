import catalog from "./catalog.js";
import { hslHex, darkenHex } from "./patterns.js";

// M6 Style tab: one-click catalog presets + auto colour-block.
// Presets apply their items with curated colours (kept stable so shots are
// deterministic); auto colour-block picks one hue and derives shades for
// top/bottom/shoes on whatever is currently worn.

// curated per-preset colours: [slot] = { main, secondary }
const PRESET_COLORS = {
  preset_preppy: {
    top: { main: "#f3ecd8", secondary: "#28406e" },
    outer: { main: "#8c2f36", secondary: "#28406e" },
    bottom: { main: "#28406e", secondary: "#c8a03a" },
    socks: { main: "#ffffff", secondary: "#28406e" },
    shoes: { main: "#ffffff", secondary: "#d8c2a0" },
    neck: { main: "#222222" },
  },
  preset_street: {
    top: { main: "#d8d8e8" },
    bottom: { main: "#3d4438" },
    headwear: { main: "#2a2a30" },
    shoes: { main: "#e8e8e8", secondary: "#c03038" },
  },
  preset_denim: {
    top: { main: "#5a7fc0" },
    outer: { main: "#2c4a80" },
    bottom: { main: "#4a6ea8" },
    bag: { main: "#a87848" },
    shoes: { main: "#e8913a" },
  },
  preset_sport: {
    top: { main: "#e8595a", secondary: "#ffffff" },
    bottom: { main: "#2a4a84" },
    socks: { main: "#ffffff", secondary: "#e8595a" },
    shoes: { main: "#ffffff", secondary: "#2a4a84" },
  },
  preset_y2k: {
    top: { main: "#f0a8c0" },
    bottom: { main: "#b078c8" },
    headwear: { main: "#ffffff" },
    shoes: { main: "#333038" },
  },
};

export function applyPreset(preset, state, onChange) {
  for (const [slot, id] of Object.entries(preset.items)) {
    const item = catalog.items.find((i) => i.id === id);
    if (!item) continue;
    state[slot] = { id, colors: {} };
    const cols = PRESET_COLORS[preset.id]?.[slot] ?? {};
    for (const cs of item.colorSlots) {
      state[slot].colors[cs] =
        cols[cs] ?? (cs === "main" ? "#ffffff" : "#222222");
    }
  }
  if (preset.auto) applyColourBlock(state, () => {});
  onChange();
}

// auto colour-block: one hue -> three related shades across the outfit
export function applyColourBlock(state, onChange, hue = null) {
  const h = hue ?? Math.floor(Math.random() * 360);
  // bottom opposite hue (offset 150) so the block actually contrasts
  const hb = (h + 150) % 360;
  const set = (slot, l, s, hueOverride = null) => {
    if (state[slot]) state[slot].colors.main = hslHex(hueOverride ?? h, s, l);
  };
  set("top", 0.62, 0.64);
  set("bottom", 0.4, 0.58, hb);
  set("socks", 0.78, 0.5);
  set("shoes", 0.32, 0.5);
  for (const slot of ["top", "outer", "bottom", "socks", "shoes"]) {
    const entry = state[slot];
    if (entry && entry.colors.secondary != null)
      entry.colors.secondary = darkenHex(entry.colors.main);
  }
  onChange();
}

// does the current state match this preset's item ids (used for the
// selected ring, works even after a reload)
function matchedPreset(state) {
  return catalog.presets.find((preset) =>
    Object.entries(preset.items).every(
      ([slot, id]) => state[slot]?.id === id
    )
  );
}

// main colours the preset would set (defaults for slots without curated col)
function presetColors(preset) {
  const out = {};
  for (const [slot, id] of Object.entries(preset.items)) {
    const item = catalog.items.find((i) => i.id === id);
    if (!item || item.colorSlots[0] !== "main") continue;
    const cols = PRESET_COLORS[preset.id]?.[slot] ?? { main: "#ffffff" };
    out[slot] = cols.main;
  }
  return out;
}

// style panel body: preset buttons (with outfit colour chips) + auto
// colour-block button; left column shows palette thumbs + selection ring
export function buildStyle(state, { onChange }) {
  const panelBody = document.getElementById("panelBody");
  const leftColumn = document.getElementById("leftColumn");

  function reRender() {
    panelBody.replaceChildren();
    const label = document.createElement("div");
    label.className = "sectionLabel";
    label.textContent = "PRESETS";
    panelBody.appendChild(label);
    const active = matchedPreset(state)?.id;
    for (const preset of catalog.presets) {
      const b = document.createElement("button");
      b.className = "panelBtn presetBtn" +
        (preset.auto ? " presetAuto" : "") +
        (preset.id === active ? " active" : "");
      const chips = presetColors(preset);
      const strip = document.createElement("span");
      strip.className = "presetChips";
      for (const hex of Object.values(chips)) {
        const c = document.createElement("span");
        c.className = "presetChip";
        c.style.background = hex;
        strip.appendChild(c);
      }
      const txt = document.createElement("span");
      txt.className = "presetTxt";
      txt.textContent = preset.label;
      b.appendChild(strip);
      b.appendChild(txt);
      if (preset.auto) {
        b.addEventListener("click", () => applyColourBlock(state, onChange, null));
        panelBody.appendChild(b);
      } else {
        b.addEventListener("click", () => {
          applyPreset(preset, state, onChange);
          reRender();
        });
        panelBody.appendChild(b);
      }

      // left column thumb: stacked outfit colour bands (smaller when 6
      // presets so the whole set fits inside the left column)
      const S = catalog.presets.length > 4 ? 34 : 56;
      const t = document.createElement("canvas");
      t.className = "thumb" + (preset.id === active ? " active" : " dim");
      t.width = t.height = S;
      t.style.width = t.style.height = S + "px";
      t.title = preset.label;
      const ctx = t.getContext("2d");
      const bandH = S > 50 ? 9 : 7;
      const cols = Object.entries(chips);
      cols.forEach(([slot, hex], i) => {
        ctx.fillStyle = hex;
        ctx.fillRect(5, 9 + i * (bandH + 2), S - 10, bandH);
        ctx.strokeStyle = "rgba(0,0,0,0.35)";
        ctx.strokeRect(5.5, 9.5 + i * (bandH + 2), S - 11, bandH - 1);
      });
      t.addEventListener("click", () => {
        if (preset.auto) applyColourBlock(state, onChange, null);
        else applyPreset(preset, state, onChange);
        reRender();
      });
      leftColumn.appendChild(t);
    }
  }

  reRender();
}
