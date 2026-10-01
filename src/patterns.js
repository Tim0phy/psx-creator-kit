import * as THREE from "three";

// M4 patterns: only catalog-specified ones for the base items built so far.
// All 32x32, nearest sampling, no mipmaps. Pattern uses colorSlot[0] (main)
// and colorSlot[1] (secondary).

// stripes: simple horizontal bands, 4 main / 4 secondary rows
function drawStripes(ctx, main, secondary) {
  ctx.fillStyle = main;
  ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = secondary;
  for (let y = 0; y < 32; y += 8) ctx.fillRect(0, y, 32, 4);
}

const DRAW = { stripes: drawStripes };

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
    (DRAW[name] || DRAW.stripes)(this.ctx, mainHex, secondaryHex);
    this.texture.needsUpdate = true;
  }
}

export function makePatternTexture(name, mainHex, secondaryHex) {
  const t = new PatternTexture();
  t.set(name, mainHex, secondaryHex);
  return t;
}
