import catalog, { SLOT_LABELS } from "./catalog.js";
import { renderThumb } from "./faceTexture.js";
import { HAIR_IDS } from "./parts/hair.js";
import { buildStyle, applyPreset, applyColourBlock } from "./uiStyle.js";

// UI: category bar switching panels (Face/Head/Top/Bottom/Shoes), pink left
// column. All item lists are data-driven from catalog.json.

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

// sections per cloth category: [slot, title]. M6: cloth panels list every
// catalog item for the slot (base + style packs); accessories tab shows all
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

function itemsFor(slot) {
  return catalog.items.filter((i) => i.slot === slot);
}

export function createUI(state, { onChange }) {
  const panel = document.getElementById("panel");
  const panelTitle = document.getElementById("panelTitle");
  const panelBody = document.getElementById("panelBody");
  const leftColumn = document.getElementById("leftColumn");
  const catBtns = [...document.querySelectorAll(".catBtn")];

  let refresh = () => {};

  function sectionLabel(text) {
    const d = document.createElement("div");
    d.className = "sectionLabel";
    d.textContent = text;
    panelBody.appendChild(d);
  }

  function circleBtn(label, onClick) {
    const b = document.createElement("button");
    b.className = "panelBtn";
    if (label instanceof HTMLCanvasElement) {
      b.appendChild(label);
      b.classList.add("iconBtn");
    } else if (label != null) {
      b.textContent = label;
    } else {
      b.innerHTML = "&nbsp;";
    }
    b.addEventListener("click", onClick);
    panelBody.appendChild(b);
    return b;
  }

  function leftThumbs(n) {
    const thumbs = [];
    for (let i = 0; i < n; i++) {
      const t = document.createElement("canvas");
      t.className = "thumb";
      t.width = t.height = 56;
      leftColumn.appendChild(t);
      thumbs.push(t);
    }
    return thumbs;
  }

  function swatchRow(sourceObj, key, swatches, label = null) {
    if (label) sectionLabel(label);
    const btns = swatches.map((hex) => {
      const b = document.createElement("button");
      b.className = "panelBtn swatchBtn";
      b.dataset.sw = `${key}:${hex.toLowerCase()}`;
      b.style.background = hex;
      b.title = hex;
      b.addEventListener("click", () => setColor(hex));
      panelBody.appendChild(b);
      return b;
    });
    const custom = document.createElement("input");
    custom.type = "color";
    custom.value = sourceObj[key];
    custom.classList.add("customSkin");
    custom.dataset.swKey = key;
    custom.title = "custom colour";
    custom.addEventListener("input", () => setColor(custom.value));
    panelBody.appendChild(custom);
      function setColor(hex) {
        sourceObj[key] = hex;
        // picking a secondary colour by hand unlocks it from the case colour
        if (key === "secondary") sourceObj.secondaryFollow = false;
        custom.value = hex;
        refresh();
        onChange();
      }
    return {
      sync: () => {
        btns.forEach((b) =>
          b.classList.toggle(
            "active",
            b.dataset.sw === `${key}:${sourceObj[key].toLowerCase()}`
          )
        );
        custom.value = sourceObj[key];
      },
    };
  }

  function drawLabel(t, text) {
    const ctx = t.getContext("2d");
    ctx.clearRect(0, 0, 56, 56);
    ctx.fillStyle = "#fff";
    ctx.font = '15px "Press Start 2P", monospace';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 28, 30);
  }

  // ---- face panel ----------------------------------------------------------
  function buildFace() {
    const thumbs = leftThumbs(3);
    sectionLabel("EYES");
    const eyeBtns = [];
    for (let i = 1; i <= EYE_COUNT; i++) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 40;
      eyeBtns.push(circleBtn(cv, () => {
        state.eyes = i; refresh(); onChange();
      }));
    }
    sectionLabel("MOUTH");
    const mouthBtns = [];
    for (let i = 1; i <= MOUTH_COUNT; i++) {
      const cv = document.createElement("canvas");
      cv.width = cv.height = 40;
      mouthBtns.push(circleBtn(cv, () => {
        state.mouth = i; refresh(); onChange();
      }));
    }
    const { swatchBtns, custom } = setSkinPicker(state, SKIN_PRESETS, "skin");
    const blushBtn = circleBtn("BLUSH", () => {
      state.blush = !state.blush; refresh(); onChange();
    });
    blushBtn.classList.add("blushBtn");

    refresh = () => {
      eyeBtns.forEach((b, i) => {
        b.classList.toggle("active", state.eyes === i + 1);
        renderThumb(b.firstChild, { ...state, mouth: 0, eyes: i + 1 });
      });
      mouthBtns.forEach((b, i) => {
        b.classList.toggle("active", state.mouth === i + 1);
        renderThumb(b.firstChild, { ...state, eyes: 0, mouth: i + 1 });
      });
      swatchBtns.forEach((b) =>
        b.classList.toggle("active", b.dataset.hex === state.skin.toLowerCase())
      );
      custom.value = state.skin;
      renderThumb(thumbs[0], { ...state, mouth: 0 });
      renderThumb(thumbs[1], { ...state, eyes: 0 });
      renderThumb(thumbs[2], { ...state, eyes: 0, mouth: 0 });
      blushBtn.classList.toggle("active", state.blush);
    };
  }

  function setSkinPicker(stateObj, swatches, key) {
    sectionLabel(key === "hair" ? "COLOUR" : "SKIN");
    const swatchBtns = swatches.map((hex) => {
      const b = document.createElement("button");
      b.className = "panelBtn swatchBtn";
      b.dataset.hex = hex.toLowerCase();
      b.style.background = hex;
      b.title = hex;
      b.addEventListener("click", () => setColor(hex));
      panelBody.appendChild(b);
      return b;
    });
    const custom = document.createElement("input");
    custom.type = "color";
    custom.value = stateObj[key];
    custom.className = "customSkin";
    custom.title = "custom colour";
    custom.addEventListener("input", () => setColor(custom.value));
    panelBody.appendChild(custom);
    function setColor(hex) {
      stateObj[key] = hex;
      custom.value = hex;
      refresh();
      onChange();
    }
    return { swatchBtns, custom };
  }

  // ---- hair panel ----------------------------------------------------------
  function buildHead() {
    const thumbs = leftThumbs(3);
    sectionLabel("STYLE");
    const styleBtns = [circleBtn("\u00d8", () => {
      state.hair.id = null; refresh(); onChange();
    })];
    HAIR_IDS.forEach((id) => {
      styleBtns.push(circleBtn(id.slice(5), () => {
        state.hair.id = id; refresh(); onChange();
      }));
    });
    const hairSw = setSkinPicker(state.hair, HAIR_SWATCHES, "color");

    refresh = () => {
      styleBtns.forEach((b, i) =>
        b.classList.toggle("active", state.hair.id === (i ? HAIR_IDS[i - 1] : null))
      );
      hairSw.sync?.();
      [...panelBody.querySelectorAll(".swatchBtn")].forEach((b) =>
        b.classList.toggle("active", b.dataset.hex === state.hair.color.toLowerCase())
      );
      panelBody.querySelectorAll(".customSkin").forEach(
        (c) => (c.value = state.hair.color)
      );
      drawSlotted(thumbs, state.hair.id, state.hair.color);
    };
  }

  function drawSlotted(thumbs, id, color) {
    drawLabel(thumbs[0], id ? String(HAIR_IDS.indexOf(id) + 1) : "\u00d8");
    const t2 = thumbs[thumbs.length - 1].getContext("2d");
    t2.clearRect(0, 0, 56, 56);
    t2.fillStyle = color;
    t2.fillRect(0, 0, 56, 56);
  }

  // ---- cloth panels (top/outer, bottom, shoes) ------------------------------
  function buildCloth(cat) {
    const sections = CLOTH_SECTIONS[cat];
    const thumbs = leftThumbs(Math.min(sections.length + 1, 4));
    const tCount = thumbs.length;

    function reRender() {
      panelBody.replaceChildren();
      sections.forEach(([slot, title], sIdx) => {
        sectionLabel(title);
        const items = itemsFor(slot);
        const none = circleBtn("\u00d8", () => {
          state[slot] = null; refresh(); onChange();
        });
        none.classList.toggle("active", !state[slot]);
        items.forEach((item, i) => {
          const b = circleBtn(String(i + 1), () => {
              // carry over this slot's colours so switching items keeps the pick
              const prev = state[slot]?.colors ?? {};
              state[slot] = { id: item.id, colors: {} };
              for (const cs of item.colorSlots) {
                state[slot].colors[cs] = prev[cs] ?? (cs === "main" ? "#ffffff" : "#222222");
              }
              // multi-colour item freshly picked: strap follows case until
              // the user explicitly picks its own secondary colour
              state[slot].colors.secondaryFollow
                = item.colorSlots.includes("secondary");
            refresh(); onChange();
          });
          b.classList.toggle("active", state[slot]?.id === item.id);
        });
        const idx = items.findIndex((it) => it.id === state[slot]?.id);
        drawLabel(thumbs[Math.min(sIdx, tCount - 2)], state[slot] ? String(idx + 1) : "\u00d8");
        const colors = state[slot]?.colors;
        if (colors) {
          const slots = catalog.items.find(
            (i) => i.id === state[slot].id
          )?.colorSlots ?? ["main"];
            slots.forEach((cs) => {
              sectionLabel(cs === "main" ? "COLOUR" : cs.toUpperCase());
              // watch: strap (secondary) tracks the case colour until the
              // user explicitly picks its own secondary colour
              const follow = cs === "secondary"
                && colors.secondaryFollow !== false;
              if (follow) colors.secondary = colors.main;
              swatchRow(colors, cs, CLOTH_SWATCHES);
            });
          const t = thumbs[thumbs.length - 1].getContext("2d");
          t.clearRect(0, 0, 56, 56);
          t.fillStyle = colors.main;
          t.fillRect(0, 0, 56, 56);
        }
      });
    }

    refresh = reRender; // re-render everything on each change
    refresh();
  }

  const BUILDERS = {
    face: buildFace,
    head: buildHead,
    top: () => buildCloth("top"),
    bottom: () => buildCloth("bottom"),
    shoes: () => buildCloth("shoes"),
    accessories: () => buildCloth("accessories"),
    style: () => buildStyle(state, { onChange, refresh: () => {} }),
  };
  const CAT_LABEL = {
    face: SLOT_LABELS.face, head: SLOT_LABELS.head,
    top: SLOT_LABELS.top, bottom: SLOT_LABELS.bottom,
    shoes: SLOT_LABELS.shoes, accessories: SLOT_LABELS.accessories,
    style: SLOT_LABELS.style,
  };
  let current = null;

  function switchCat(cat) {
    if (cat === current) return;
    current = cat;
    panelBody.replaceChildren();
    leftColumn.replaceChildren();
    panel.dataset.cat = cat;
    panelTitle.textContent = CAT_LABEL[cat] || cat.toUpperCase();
    catBtns.forEach((b) =>
      b.classList.toggle("active", b.dataset.cat === cat)
    );
    refresh = () => {};
    BUILDERS[cat]?.();
    refresh();
  }

  catBtns.forEach((b) =>
    b.addEventListener("click", () => switchCat(b.dataset.cat))
  );
  const startCat = new URLSearchParams(location.search).get("cat");
  switchCat(startCat && BUILDERS[startCat] ? startCat : "face");

  return { switchCat };
}
