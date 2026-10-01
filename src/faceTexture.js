import * as THREE from "three";

// Procedural face texture: 32x32 pixel art upscaled to 128x128, no AA.
// Layers: skin base -> blush (optional) -> eyes -> mouth.

const S = 32;
const P = {
  outline: "#26221e",
  pupil: "#332b26",
  white: "#ffffff",
  blush: "#f2a2ac",
  tongue: "#e07890",
};

function px(ctx, x, y, w = 1, h = 1, c) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

// ---- eyes ----------------------------------------------------------------
const EY = 7; // top of eye box
const EH = 10;

function eyeRound(ctx, cx) {
  px(ctx, cx - 3, EY, 7, EH, P.outline);
  px(ctx, cx - 2, EY + 1, 5, EH - 2, P.white);
  px(ctx, cx - 2, EY + 3, 3, EH - 4, P.pupil);
  px(ctx, cx - 1, EY + 1 + 2, 1, 1, P.white);
}

function eyeHalfLidded(ctx, cx) {
  eyeRound(ctx, cx);
  px(ctx, cx - 2, EY + 1, 5, 2, P.outline);
}

function eyeBrow(ctx, cx, mirror, c) {
  // slanted brow above eye, inward end lower (angry) or flat (sleepy)
  if (c === "flat") {
    px(ctx, cx - 3, EY - 3, 7, 1, P.outline);
    px(ctx, cx - 3, EY - 2, 2, 1, P.outline);
    px(ctx, cx + 2, EY - 2, 2, 1, P.outline);
  } else {
    if (mirror < 0) {
      px(ctx, cx - 3, EY - 4, 2, 1, P.outline);
      px(ctx, cx - 1, EY - 3, 2, 1, P.outline);
      px(ctx, cx + 1, EY - 2, 2, 1, P.outline);
    } else {
      px(ctx, cx + 1, EY - 4, 2, 1, P.outline);
      px(ctx, cx - 1, EY - 3, 2, 1, P.outline);
      px(ctx, cx - 3, EY - 2, 2, 1, P.outline);
    }
  }
}

function eyeAngry(ctx, cx, mirror) {
  eyeRound(ctx, cx);
  eyeBrow(ctx, cx, mirror, "angry");
}

function eyeSleepy(ctx, cx, mirror) {
  eyeRound(ctx, cx);
  px(ctx, cx - 2, EY + 1, 5, 3, P.outline);
  px(ctx, cx - 1, EY + 4, 3, 3, P.pupil);
  eyeBrow(ctx, cx, mirror, "flat");
}

function eyeDroopy(ctx, cx, mirror) {
  eyeRound(ctx, cx);
  px(ctx, cx - 2, EY + 1, 3, 2, P.outline); // upper lid slanting down-out
  if (mirror < 0) px(ctx, cx + 2, EY + 1, 1, 1, P.outline);
  else px(ctx, cx - 2, EY + 2, 1, 1, P.outline);
  px(ctx, cx - 1, EY + 2, 3, 4, P.pupil);
  px(ctx, cx - 1, EY + 2, 1, 1, P.white);
}

function arcUp(ctx, x, top, w, c) {
  for (let i = 0; i < w; i++) {
    const dy = Math.round(Math.abs(i - (w - 1) / 2) * 0.9);
    px(ctx, x + i, top + dy, 1, 1, c);
  }
}

function eyeClosedHappy(ctx, cx, mirror) {
  arcUp(ctx, cx - 3, EY + 3, 7, P.outline);
}

function eyeU(ctx, cx) {
  for (let i = 0; i < 5; i++) {
    px(ctx, cx - 3 + i, EY + 2, 1, 1, P.outline);
    if (i === 0 || i === 4) px(ctx, cx - 3 + i, EY + 3, 1, 3, P.outline);
  }
  px(ctx, cx - 2, EY + 5, 3, 1, P.outline);
}

function eyeSquint(ctx, cx, mirror) {
  // ">_<": angular squeezed eyes
  const s = mirror < 0 ? 1 : -1; // chevron points inward-down
  for (let i = 0; i < 3; i++) {
    px(ctx, cx - 2 + i * s, EY + 2, 1, 1, P.outline);           // top diagonal
    px(ctx, cx - 2 + i * s, EY + 4, 1, 1, P.outline);           // bottom diagonal
  }
  px(ctx, mirror < 0 ? cx : cx - 1, EY + 3, 1, 1, P.outline);   // apex
  px(ctx, cx - 2, EY + 1, 5, 1, P.outline);                     // squeeze marks
  px(ctx, cx - 2, EY + 5, 5, 1, P.outline);
}

function eyePill(ctx, cx) {
  px(ctx, cx - 3, EY, 7, EH, P.outline);
  px(ctx, cx - 2, EY + 1, 5, EH - 2, P.pupil);
  px(ctx, cx - 2, EY + 1, 2, 2, P.white);
}

function eyeDot(ctx, cx) {
  px(ctx, cx - 1, EY + 3, 4, 6, P.outline);
  px(ctx, cx, EY + 4, 2, 4, P.pupil);
  px(ctx, cx, EY + 4, 1, 1, P.white);
}

function ring(ctx, x0, y0, w, h, c) {
  px(ctx, x0, y0, w, 1, c);
  px(ctx, x0, y0 + h - 1, w, 1, c);
  px(ctx, x0, y0, 1, h, c);
  px(ctx, x0 + w - 1, y0, 1, h, c);
}

function eyeSpiral(ctx, cx) {
  px(ctx, cx - 3, EY, 7, EH, P.outline);
  px(ctx, cx - 2, EY + 1, 5, EH - 2, P.white);
  ring(ctx, cx - 2, EY + 1, 5, EH - 2, P.pupil);
  ring(ctx, cx - 1, EY + 2, 3, EH - 4, P.pupil);
  px(ctx, cx, EY + 3, 1, 2, P.pupil);
}

function eyeFlat(ctx, cx) {
  px(ctx, cx - 3, EY + 4, 7, 1, P.outline);
}

const EYES = [
  eyeRound,
  eyeHalfLidded,
  eyeAngry,
  eyeSleepy,
  eyeDroopy,
  eyeClosedHappy,
  eyeU,
  eyeSquint,
  eyePill,
  eyeDot,
  eyeSpiral,
  eyeFlat,
];

// ---- mouth ---------------------------------------------------------------
const MX = 16;
const MY = 20;

function mSmile(ctx) {
  for (let i = -3; i <= 3; i++) px(ctx, MX + i, MY - Math.abs(3 - Math.abs(i)), 1, 1, P.outline);
  px(ctx, MX - 3, MY + 1, 7, 1, P.outline);
}

function mCat(ctx) {
  px(ctx, MX - 3, MY - 1, 1, 2, P.outline);
  px(ctx, MX - 2, MY, 1, 1, P.outline);
  px(ctx, MX - 1, MY - 1, 1, 2, P.outline);
  px(ctx, MX, MY, 1, 1, P.outline);
  px(ctx, MX + 1, MY - 1, 1, 2, P.outline);
  px(ctx, MX + 2, MY, 1, 1, P.outline);
  px(ctx, MX + 3, MY - 1, 1, 2, P.outline);
}

function mFlat(ctx) {
  px(ctx, MX - 2, MY, 5, 1, P.outline);
}

function mOpen(ctx) {
  px(ctx, MX - 2, MY - 1, 5, 4, P.outline);
  px(ctx, MX - 1, MY, 3, 2, P.pupil);
}

function mSmallO(ctx) {
  ring(ctx, MX - 1, MY, 3, 3, P.outline);
}

function mTongue(ctx) {
  mSmile(ctx);
  px(ctx, MX + 1, MY + 2, 2, 2, P.tongue);
}

const MOUTHS = [mSmile, mCat, mFlat, mOpen, mSmallO, mTongue];

// ---- composed draw --------------------------------------------------------
export function drawFace32(ctx, state) {
  ctx.clearRect(0, 0, S, S);
  px(ctx, 0, 0, S, S, state.skin);
  if (state.blush) {
    px(ctx, 4, 17, 3, 2, P.blush);
    px(ctx, 25, 17, 3, 2, P.blush);
  }
  const ei = (state.eyes ?? 1) - 1;
  if (ei >= 0) {
    EYES[ei % 12](ctx, 10, -1);
    EYES[ei % 12](ctx, 22, 1);
  }
  const mi = (state.mouth ?? 1) - 1;
  if (mi >= 0) MOUTHS[mi % 6](ctx);
}

const bigCache = new Map();
export function bigFor(small) {
  if (!bigCache.has(small)) {
    const big = document.createElement("canvas");
    big.width = big.height = 128;
    bigCache.set(small, big);
  }
  return bigCache.get(small);
}

export function renderFace(small, big, state) {
  drawFace32(small.getContext("2d"), state);
  const bctx = big.getContext("2d");
  bctx.imageSmoothingEnabled = false;
  bctx.clearRect(0, 0, 128, 128);
  bctx.drawImage(small, 0, 0, 128, 128);
}

export function renderThumb(canvas, state, part) {
  // circle thumb: face silhouette with the given part visible; part =
  // "eyes" | "mouth" | "skin" (skin = plain swatch with blush if set)
  const size = canvas.width;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  const mini = document.createElement("canvas");
  mini.width = mini.height = S;
  const st = { ...state };
  if (part === "eyes") st.mouth = 0;
  if (part === "mouth") st.eyes = 0;
  if (part === "skin") {
    st.eyes = 0;
    st.mouth = 0;
  }
  drawFace32(mini.getContext("2d"), st);
  ctx.clearRect(0, 0, size, size);
  ctx.drawImage(mini, 0, 0, size, size);
}

export function makeFaceTexture(bigCanvas) {
  const tex = new THREE.CanvasTexture(bigCanvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}
