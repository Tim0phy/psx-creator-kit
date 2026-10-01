import * as THREE from "three";
import { makePSXMaterial } from "../psxRenderer.js";
import { makePatternTexture } from "../patterns.js";

// M4 shoes + socks. Socks are tubes around the legs, drawn under the shoes
// (smaller radius, cuffs above the ankle). Shoes are chunky boxes over the
// base feet plus a sole plate and an ankle cuff.
// Feet: 0.32 x 0.18 x 0.44 box at (±0.19, 0.09, 0.08) so top y=0.18.

function sockTube(mat, side, opt) {
  const g = new THREE.BoxGeometry(opt.r, opt.top - opt.bottom, opt.r)
    .toNonIndexed();
  const p = g.attributes.position;
  const h = opt.top - opt.bottom;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + h / 2) / h;
    // follow the leg taper: slightly smaller radius than the leg at knee
    const w = 1 - 0.28 * (1 - t);
    p.setXYZ(i, p.getX(i) * w + side * 0.19, p.getY(i), p.getZ(i) * w);
  }
  g.translate(0, opt.bottom + h / 2, 0);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

function addSocks(group, mat, opt) {
  for (const side of [-1, 1]) group.add(sockTube(mat, side, opt));
}

const SOCK_BUILDER = {
  socks_white_long(g, m) {
    addSocks(g, m, { r: 0.39, top: 0.52, bottom: 0.2 });
    // ankle-to-knee tube; foot part left bare (shoes cover it)
  },
  socks_knee_stripe(g, m) {
    addSocks(g, m, { r: 0.39, top: 0.56, bottom: 0.2 });
  },
};

const SHOE_BUILDER = {
  shoe_sneaker(g, m) {
    for (const side of [-1, 1]) {
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.2, 0.5).toNonIndexed(), m
      );
      body.position.set(side * 0.19, 0.13, 0.08);
      const sole = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.07, 0.46).toNonIndexed(), m
      );
      sole.position.set(side * 0.19, 0.035, 0.08);
      const cuff = new THREE.Mesh(
        new THREE.BoxGeometry(0.3, 0.1, 0.3).toNonIndexed(), m
      );
      cuff.position.set(side * 0.19, 0.24, 0);
      g.add(body, sole, cuff);
    }
  },
};

export function createSocks(id, colors) {
  const group = new THREE.Group();
  let mat, pattern;
  const item = SOCK_BUILDER[id] ? id : null;
  if (item) {
    if (item === "socks_knee_stripe") {
      pattern = makePatternTexture("stripes", colors.main, colors.secondary);
      mat = makePSXMaterial("#ffffff", { map: pattern.texture, gradient: 0.1 });
    } else {
      mat = makePSXMaterial(colors.main, { gradient: 0.1 });
    }
    SOCK_BUILDER[item](group, mat);
  }
  let tris = 0;
  group.traverse((o) => {
    if (o.isMesh) {
      o.geometry.computeBoundingSphere();
      tris += o.geometry.attributes.position.count / 3;
    }
  });
  if (item) console.log(`[psxcc] ${id}: ${tris} tris (max 150)`);
  return { group, mat, pattern };
}

export function createShoes(id, colorHex) {
  const group = new THREE.Group();
  const mat = makePSXMaterial(colorHex, { gradient: 0.12 });
  if (SHOE_BUILDER[id]) SHOE_BUILDER[id](group, mat);
  let tris = 0;
  group.traverse((o) => {
    if (o.isMesh) {
      o.geometry.computeBoundingSphere();
      tris += o.geometry.attributes.position.count / 3;
    }
  });
  if (SHOE_BUILDER[id]) console.log(`[psxcc] ${id}: ${tris} tris (max 150)`);
  return { group, mat };
}
