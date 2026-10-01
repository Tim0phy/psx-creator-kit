import catalog, { SLOT_LABELS } from "./catalog.js";
import { renderThumb } from "./faceTexture.js";
import { HAIR_IDS } from "./parts/hair.js";

// UI: category bar switching panels (Face / Head for M3), pink left column.
// All item lists are data-driven.

const EYE_COUNT = catalog.eyes;
const MOUTH_COUNT = catalog.mouths;
const SKIN_PRESETS = catalog.palettes.skin;
const HAIR_SWATCHES = [
  "#ffffff", "#222222", "#c0c0c0", "#8a5a3a", "#5a3a24",
  "#ffb3c7", "#c8f56b", "#9fd6ff", "#fff3a6", "#d9c2ff",
];

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

  function setSkinPicker(state, swatches, key) {
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
    custom.value = state[key];
    custom.className = "customSkin";
    custom.title = "custom colour";
    custom.addEventListener("input", () => setColor(custom.value));
    panelBody.appendChild(custom);
    function setColor(hex) {
      state[key] = hex;
      custom.value = hex;
      refresh();
      onChange();
    }
    return { swatchBtns, custom };
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

  // ---- hair panel ----------------------------------------------------------
  function buildHead() {
    const thumbs = leftThumbs(3);
    hairButtons();
    setSkinPicker(state.hair, HAIR_SWATCHES, "color");

    function hairButtons() {
      sectionLabel("STYLE");
      // option 0 = none, then hair_01.. (data-driven, phase-limited)
      circleBtn("\u00d8", () => {
        state.hair.id = null; refresh(); onChange();
      });
      HAIR_IDS.forEach((id) => {
        circleBtn(id.slice(5), () => {
          state.hair.id = id; refresh(); onChange();
        });
      });
    }

    refresh = () => {
      [...panelBody.querySelectorAll(".panelBtn")].forEach((b, i) => {
        if (i === 0) b.classList.toggle("active", state.hair.id === null);
        else b.classList.toggle("active", state.hair.id === HAIR_IDS[i - 1]);
      });
      swatchButtonsRefresh();
      thumbsRefresh();
    };

    function swatchButtonsRefresh() {
      const btns = [...panelBody.querySelectorAll(".swatchBtn")];
      btns.forEach((b) =>
        b.classList.toggle("active", b.dataset.hex === state.hair.color.toLowerCase())
      );
      const custom = panelBody.querySelector(".customSkin");
      if (custom) custom.value = state.hair.color;
    }

    function thumbsRefresh() {
      // left column: style number, blank, colour swatch
      const t0 = thumbs[0].getContext("2d");
      t0.clearRect(0, 0, 56, 56);
      t0.fillStyle = "#fff";
      t0.font = '16px "Press Start 2P", monospace';
      t0.textAlign = "center";
      t0.textBaseline = "middle";
      t0.fillText(state.hair.id ? state.hair.id.slice(5) : "\u00d8", 28, 30);
      const t2 = thumbs[2].getContext("2d");
      t2.clearRect(0, 0, 56, 56);
      t2.fillStyle = state.hair.color;
      t2.fillRect(0, 0, 56, 56);
    }
  }

  const BUILDERS = { face: buildFace, head: buildHead };
  const CAT_LABEL = { face: SLOT_LABELS.face, head: SLOT_LABELS.head };
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
  switchCat("face");

  return { switchCat };
}
