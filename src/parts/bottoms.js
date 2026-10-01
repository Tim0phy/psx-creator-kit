import * as THREE from "three";
import { makePSXMaterial } from "../psxRenderer.js";

// M4 bottoms (base set): tapered pants, shorts, faceted (low-poly 8-sided)
// skirts. Catalog flags: lowRise -> waistline drops to the hip so skin shows
// between top and bottom; wide -> wider at ankle (reverse taper).
// Torso bottom y=0.58, legs y 0.06..0.62 at x ±0.19 (half-w ~0.17->0.135),
// feet top y=0.18.

const WAIST = 0.74; // normal waistband top
const HIP = 0.6;    // low-rise waistband top (on the hips)

// hips/pelvis block from y=0.5 up to waistY. Narrower than any top shell
// (tee 1.06 -> half-w 0.297) so the two never intersect and z-fight.
function hipsMesh(mat, waistY) {
  const h = waistY - 0.5;
  const g = new THREE.BoxGeometry(0.56, h, 0.3).toNonIndexed();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + h / 2) / h; // 0 bottom -> 1 top
    p.setX(i, p.getX(i) * ((0.5 + 0.06 * (1 - t)) / 0.56));
  }
  g.translate(0, 0.5 + h / 2, 0);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

// two pant/tube legs: tapered boxes, narrower towards the ankle
// (taper = fraction narrower at the bottom end; negative -> wider, "wide")
function tubeMeshes(group, mat, opt) {
  const h = opt.top - opt.bottom;
  for (const side of [-1, 1]) {
    const g = new THREE.BoxGeometry(opt.r, h, opt.r).toNonIndexed();
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const t = (p.getY(i) + h / 2) / h; // 0 at bottom, 1 at top
      const w = 1 - opt.taper * (1 - t); // top=1, bottom=1-taper
      const x =
        p.getX(i) * w + side * 0.19 * (1 + (opt.splay ?? 0) * (1 - t));
      p.setXYZ(i, x, p.getY(i), p.getZ(i) * w);
    }
    g.translate(0, opt.bottom + h / 2, 0);
    g.computeVertexNormals();
    group.add(new THREE.Mesh(g, mat));
  }
}

// faceted skirt: open 8-sided flare cone (8 quads = flat facets), not smooth
function skirtMesh(mat, rTop, rBottom, topY, botY) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, topY - botY, 8, 1, true);
  g.translate(0, (topY + botY) / 2, 0);
  const a = g.toNonIndexed();
  a.computeVertexNormals();
  return new THREE.Mesh(a, mat);
}

// waistband + skirt mouths r 0.32 (half-w ~0.296) stay inside the tee shell
// (0.297) -> no clipping with tops; skirts flare wider below the tee hem.
function waistbandMesh(mat, waistY) {
  const g = new THREE.CylinderGeometry(0.32, 0.32, 0.07, 8, 1, true)
    .toNonIndexed();
  g.translate(0, waistY + 0.3, 0);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

const BOTTOM_BUILDER = {
  bot_long_pants(g, m, f) {
    const waist = f.lowRise ? HIP : WAIST;
    g.add(hipsMesh(m, waist));
    tubeMeshes(g, m, { r: 0.4, top: 0.64, bottom: 0.1, taper: 0.15, splay: 0.03 });
  },
  bot_shorts(g, m, f) {
    const waist = f.lowRise ? HIP : WAIST;
    g.add(hipsMesh(m, waist));
    tubeMeshes(g, m, { r: 0.4, top: 0.56, bottom: 0.38, taper: -0.05, splay: 0.03 });
  },
  bot_short_skirt(g, m, f) {
    const waist = f.lowRise ? HIP : WAIST;
    g.add(waistbandMesh(m, waist));
    g.add(skirtMesh(m, 0.32, 0.5, waist + 0.3, waist - 0.28));
  },
  bot_long_skirt(g, m, f) {
    const waist = f.lowRise ? HIP : WAIST;
    g.add(waistbandMesh(m, waist));
    g.add(skirtMesh(m, 0.34, 0.62, waist + 0.28, 0.14));
  },
};

export function createBottom(id, colorHex, flags = {}) {
  const group = new THREE.Group();
  const mat = makePSXMaterial(colorHex, {
    side: THREE.DoubleSide, gradient: 0.18,
  });
  if (BOTTOM_BUILDER[id]) BOTTOM_BUILDER[id](group, mat, flags);
  let tris = 0;
  group.traverse((o) => {
    if (o.isMesh) {
      o.geometry.computeBoundingSphere();
      tris += o.geometry.attributes.position.count / 3;
    }
  });
  console.log(`[psxcc] ${id}: ${tris} tris (max 150)`);
  return { group, mat };
}
