import * as THREE from "three";

// M6 patterns: plaid / stripes / denim / number / star / metallic, all 32x32
// canvases, NearestFilter, no mipmaps. main = colorSlot[0], secondary =
// colorSlot[1]. A crest/number decal is a second transparent 32x32 layer.

// crosshatch of dark + light thread pairs between the main fill (denim wash)
function drawDenim(ctx, main) {
  ctx.fillStyle = main;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = "rgba(0,0,0,0.20)";
  for (let i = 0; i < 32; i += 4) {
    ctx.fillRect(0, i, 32, 1);
    ctx.fillRect(i, 0, 1, 32);
  }
  ctx.fillStyle = "rgba(255,255,255,0.16)";
  for (let i = 1; i < 32; i += 4) ctx.fillRect(i, 0, 1, 32);
  for (let i = 2; i < 32; i += 4) ctx.fillRect(0, i, 32, 1);
  // faded wash streaks (asymmetric so it reads as washing, not tiling)
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.fillRect(4, 10, 6, 12);
  ctx.fillRect(20, 22, 7, 8);
}

// three-color plaid: main field, 6px secondary bands both axes + thin accents
function drawPlaid(ctx, main, secondary) {
  ctx.fillStyle = main;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = secondary;
  ctx.fillRect(0, 4, 32, 6);
  ctx.fillRect(4, 0, 6, 32);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, 20, 32, 2);
  ctx.fillRect(20, 0, 2, 32);
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(0, 21, 32, 2);
  ctx.fillRect(21, 0, 2, 32);
}

// ASYMMETRIC star grid so the tiling seams are invisible (SYN CHECK: tiling)
function drawStar(ctx, main, secondary) {
  ctx.fillStyle = main;
  ctx.fillRect(0, 0, 32, 32);
  star5(ctx, 9, 9, 6, secondary);
  star5(ctx, 25, 25, 4, secondary);
}

// 5-point pixel star centred at (cx, cy), arm length r
function star5(ctx, cx, cy, r, c) {
  ctx.fillStyle = c;
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++) {
      const d = Math.abs(x * 1.2) + Math.abs(y);
      if (d <= r * 0.7 || (Math.abs(y) <= r * 0.25 && Math.abs(x) <= r))
        ctx.fillRect(cx + x, cy + y, 1, 1);
    }
}

// metallic: diagonal shine bands over the main colour (foiled look)
function drawMetallic(ctx, main) {
  ctx.fillStyle = main;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = "rgba(255,255,255,0.34)";
  for (let i = -32; i < 32; i += 8) {
    for (let k = 0; k < 4; k++) ctx.fillRect(i + k, 31 - k, 1, 1);
    for (let k = 0; k < 4; k++) ctx.fillRect(i + 4 + k, 31 - k, 1, 1);
  }
  ctx.fillStyle = "rgba(0,0,0,0.22)";
  for (let i = -32; i < 32; i += 8) {
    for (let k = 0; k < 4; k++) ctx.fillRect(i + 3 - k, k, 1, 1);
  }
}

function stripePattern(main, secondary) {
  return (ctx) => {
    ctx.fillStyle = main;
    ctx.fillRect(0, 0, 32, 32);
    ctx.fillStyle = secondary;
    for (let y = 0; y < 32; y += 8) ctx.fillRect(0, y, 32, 4);
  };
}

const DRAW = {
  stripes: (c, m, s) => stripePattern(m, s)(c),
  plaid: drawPlaid,
  denim: drawDenim,
  star: (c, m, s) => drawStar(c, m, s),
  metallic: (c, m) => drawMetallic(c, m),
};

export class PatternTexture {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = this.canvas.height = 32;
    this.ctx = this.canvas.getContext("2d");
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.magFilter = THREE.NearestFilter;
    this.texture.minFilter = THREE.NearestFilter;
    this.texture.generateMipmaps = false;
  }
  set(name, mainHex, secondaryHex) {
    (DRAW[name] || DRAW.stripes)(this.ctx, mainHex, secondaryHex ?? darkenHex(mainHex));
    this.texture.needsUpdate = true;
  }
}

function darkenHex(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * 0.4);
  const g = Math.round(((n >> 8) & 255) * 0.4);
  const b = Math.round((n & 255) * 0.4);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

// transparent 32x32 decal (crest / number) returned as a CanvasTexture
function crestCanvas() {
  const cv = document.createElement("canvas");
  cv.width = cv.height = 32;
  return cv;
}

function drawCrest(ctx) {
  // ORIGINAL emblem: shield outline + chevron, no real brand marks
  ctx.fillStyle = "#26221e";
  ctx.fillRect(8, 5, 16, 1);
  ctx.fillRect(8, 5, 1, 12);
  ctx.fillRect(23, 5, 1, 12);
  ctx.fillRect(8, 17, 16, 1);
  ctx.fillRect(8, 18, 2, 1);
  ctx.fillRect(22, 18, 2, 1);
  ctx.fillRect(10, 19, 3, 1);
  ctx.fillRect(19, 19, 3, 1);
  ctx.fillRect(13, 20, 6, 1);
  ctx.fillRect(15, 21, 2, 1);
  // shield fill + chevron band
  ctx.fillStyle = "#e8b93a";
  ctx.fillRect(9, 6, 14, 11);
  ctx.fillStyle = "#b04a68";
  ctx.fillRect(9, 7, 14, 3);
  ctx.fillRect(11, 10, 10, 2);
  ctx.fillRect(13, 12, 6, 2);
  ctx.fillStyle = "#e8b93a";
  ctx.fillRect(15, 8, 2, 6);
}

function drawNumber(ctx, n = "12") {
  // big pixel jersey number, 5x7 digit font
  ctx.fillStyle = "#26221e";
  ctx.font = "bold 12px monospace";
  ctx.textAlign = "center";
  ctx.fillText(n, 16, 12);
}

export function makeDecal(kind, hex) {
  const cv = crestCanvas();
  const ctx = cv.getContext("2d");
  if (kind === "crest") drawCrest(ctx);
  else drawNumber(ctx, hex ?? "12");
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

export function makePatternTexture(name, mainHex, secondaryHex) {
  const t = new PatternTexture();
  t.set(name, mainHex, secondaryHex);
  return t;
}

export { star5 };
