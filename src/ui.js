import catalog, { SLOT_LABELS } from "./catalog.js";
import { renderThumb } from "./faceTexture.js";

// M2 UI: Face panel (eyes grid + mouth grid + blush + skin picker),
// pink selected column on the left, category bar.

const EYE_COUNT = catalog.eyes;
const MOUTH_COUNT = catalog.mouths;
const SKIN_PRESETS = catalog.palettes.skin;

export function createFaceUI(state, { onChange }) {
  const panelTitle = document.getElementById("panelTitle");
  const panelBody = document.getElementById("panelBody");
  const leftColumn = document.getElementById("leftColumn");

  const thumbs = [];
  for (let i = 0; i < 3; i++) {
    const t = document.createElement("canvas");
    t.className = "thumb";
    t.width = t.height = 56;
    leftColumn.appendChild(t);
    thumbs.push(t);
  }

  function sectionLabel(text) {
    const d = document.createElement("div");
    d.className = "sectionLabel";
    d.textContent = text;
    panelBody.appendChild(d);
  }

  function circleBtn(label, active, onClick) {
    const b = document.createElement("button");
    b.className = "panelBtn" + (active ? " active" : "");
    if (label instanceof HTMLCanvasElement) {
      b.appendChild(label);
      b.classList.add("iconBtn");
    } else if (label != null) {
      b.textContent = label;
    }
    b.addEventListener("click", onClick);
    panelBody.appendChild(b);
    return b;
  }

  // eyes -------------------------------------------------------------------
  sectionLabel("EYES");
  const eyeBtns = [];
  for (let i = 1; i <= EYE_COUNT; i++) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 40;
    eyeBtns.push(circleBtn(cv, state.eyes === i, () => {
      state.eyes = i;
      refresh();
      onChange();
    }));
  }

  sectionLabel("MOUTH");
  const mouthBtns = [];
  for (let i = 1; i <= MOUTH_COUNT; i++) {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 40;
    mouthBtns.push(circleBtn(cv, state.mouth === i, () => {
      state.mouth = i;
      refresh();
      onChange();
    }));
  }

  sectionLabel("SKIN");
  const skinSwatches = SKIN_PRESETS.map((hex) => {
    const b = document.createElement("button");
    b.className = "panelBtn swatchBtn";
    b.dataset.hex = hex.toLowerCase();
    b.style.background = hex;
    b.title = hex;
    b.addEventListener("click", () => setSkin(hex));
    panelBody.appendChild(b);
    return b;
  });

  const custom = document.createElement("input");
  custom.type = "color";
  custom.value = state.skin;
  custom.className = "customSkin";
  custom.title = "custom skin colour";
  custom.addEventListener("input", () => setSkin(custom.value));
  panelBody.appendChild(custom);

  // blush toggle -------------------------------------------------------------
  const blushBtn = document.createElement("button");
  blushBtn.className = "panelBtn blushBtn";
  blushBtn.textContent = "BLUSH";
  blushBtn.style.width = "auto";
  blushBtn.style.borderRadius = "26px";
  blushBtn.style.padding = "0 10px";
  blushBtn.style.fontSize = "7px";
  blushBtn.style.height = "26px";
  blushBtn.addEventListener("click", () => {
    state.blush = !state.blush;
    refresh();
    onChange();
  });
  panelBody.appendChild(blushBtn);

  function setSkin(hex) {
    state.skin = hex;
    custom.value = hex;
    refresh();
    onChange();
  }

  function refresh() {
    // redraw eye/mouth thumbs + actives + left column
    eyeBtns.forEach((b, i) => {
      b.classList.toggle("active", state.eyes === i + 1);
      renderThumb(b.firstChild, { ...state, mouth: 0, eyes: i + 1 });
    });
    mouthBtns.forEach((b, i) => {
      b.classList.toggle("active", state.mouth === i + 1);
      renderThumb(b.firstChild, { ...state, eyes: 0, mouth: i + 1 });
    });
    skinSwatches.forEach((b) =>
      b.classList.toggle("active", b.dataset.hex === state.skin.toLowerCase())
    );
    renderThumb(thumbs[0], { ...state, mouth: 0 });
    renderThumb(thumbs[1], { ...state, eyes: 0 });
    renderThumb(thumbs[2], { ...state, eyes: 0, mouth: 0 });
    blushBtn.classList.toggle("active", state.blush);
  }

  panelTitle.textContent = SLOT_LABELS.face;
  refresh();

  return { refresh };
}
