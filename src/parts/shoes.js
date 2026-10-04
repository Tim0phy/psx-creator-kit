import * as THREE from "three";
import { makePSXMaterial } from "../psxRenderer.js";

// M4 shoes (base sneaker) + M6 style packs. Shoes are compact boxes over the
// base feet plus a sole plate and a slim ankle cuff.
// Feet: 0.20 x 0.13 x 0.32 box at (±0.19, 0.065, 0.06) so top y=0.13.
// Legs: y 0.06..0.62, z half 0.17 -> shoe walls must strictly enclose that
// envelope (no coplanar back faces).

function bx(g, m, w, h, d, x, y, z) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d).toNonIndexed(), m);
  mesh.position.set(x, y, z);
  g.add(mesh);
  return mesh;
}

// base sneaker reused by the white variant (main colour only)
function sneaker(g, m) {
  for (const side of [-1, 1]) {
    // body: x half 0.18 strictly covers the leg (0.142 at these heights,
    // with side margin), z back -0.19 strictly covers the leg's back face
    // (-0.17), front 0.28 just past the foot toe (0.22)
    bx(g, m, 0.36, 0.16, 0.47, side * 0.19, 0.09, 0.045);
    bx(g, m, 0.3, 0.07, 0.43, side * 0.19, 0.045, 0.05);
    // slim ankle collar: x half 0.18 covers the leg (0.158 max), inner edges
    // (±0.01) keep a gap between collars; spans 0.10..0.26 (taller than the
    // shoe body top 0.17) so a -45 deg pitched body stays INSIDE the collar
    // and the ankle opening can never show through; shin frame (untagged)
    bx(g, m, 0.36, 0.16, 0.42, side * 0.19, 0.18, 0);
  }
}

const SHOE_BUILDER = {
  shoe_sneaker: sneaker,
  shoe_white_sneaker(g, m, s) {
    sneaker(g, m);
    // contrasting toe cap + sole stripe in the secondary colour
    for (const side of [-1, 1]) {
      bx(g, s, 0.3, 0.06, 0.14, side * 0.19, 0.13, 0.2);
      bx(g, s, 0.32, 0.02, 0.44, side * 0.19, 0.075, 0.05);
    }
  },
  // chunky platform: taller sole + body, keeps the sneaker cuff silhouette
  shoe_platform(g, m, s) {
    for (const side of [-1, 1]) {
      bx(g, s, 0.38, 0.1, 0.5, side * 0.19, 0.055, 0.05); // platform sole
      bx(g, m, 0.38, 0.18, 0.5, side * 0.19, 0.16, 0.045); // taller body
      bx(g, m, 0.38, 0.14, 0.44, side * 0.19, 0.19, 0); // ankle collar (foot frame)
    }
  },
  // flat Mary Jane: thin sole, low body, strap across the instep
  shoe_mary_jane(g, m, s) {
    for (const side of [-1, 1]) {
      bx(g, m, 0.34, 0.12, 0.46, side * 0.19, 0.08, 0.04);
      bx(g, s, 0.28, 0.05, 0.44, side * 0.19, 0.03, 0.05); // slim sole
      bx(g, s, 0.36, 0.03, 0.08, side * 0.19, 0.145, 0.02); // instep strap
      bx(g, s, 0.05, 0.03, 0.03, side * 0.19, 0.145, -0.05); // buckle
    }
  },
  // knee-high boots: sneaker foot + tall shaft wrapping the leg up to y 0.62;
  // M6.5: the shaft is split at the true knee with the SAME 0.12 overlap
  // RIG.kneeOver uses for pant tubes - the thigh band reaches past the knee
  // (0.22..0.62) and the shin band nests inside it (0.2..0.46), so deep
  // knee folds (up to 90 deg) never open a shaft wedge that shows leg.
  shoe_knee_boots(g, m, s) {
    for (const side of [-1, 1]) {
      bx(g, m, 0.36, 0.16, 0.47, side * 0.19, 0.09, 0.045);
      bx(g, s, 0.3, 0.07, 0.43, side * 0.19, 0.045, 0.05);
      const tag = side < 0 ? "L" : "R";
      const thigh = new THREE.Group();
      thigh.userData = { clothPart: "thigh" + tag };
      thigh.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4).toNonIndexed(), m));
      thigh.children[0].position.set(side * 0.19, 0.42, 0); // spans 0.22..0.62
      thigh.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.42).toNonIndexed(), s));
      thigh.children[1].position.set(side * 0.19, 0.59, 0); // fold-over cuff
      const shin = new THREE.Group();
      shin.userData = { clothPart: "knee" + tag };
      shin.add(new THREE.Mesh(new THREE.BoxGeometry(0.384, 0.26, 0.384).toNonIndexed(), m));
      shin.children[0].position.set(side * 0.19, 0.33, 0); // spans 0.2..0.46
      // (0.24 belt nests into the thigh band 0.22..0.62: a 38..92 deg knee
      // fold keeps the nest inside the band)
      g.add(thigh, shin);
    }
  },
};

export function createShoes(id, colors) {
  const raw = new THREE.Group();
  const main = colors.main ?? "#ffffff";
  // DoubleSide: single-sided boxes read as hollow from above (looking into a
  // pitched shoe shows the culled interior = the skin foot appears to pierce
  // the shoe); both faces make every shoe render as a solid volume
  const mat = makePSXMaterial(main, { gradient: 0.12, side: THREE.DoubleSide });
  let secMat = null;
  if (SHOE_BUILDER[id]) {
    if (colors.secondary) {
      secMat = makePSXMaterial(colors.secondary, { gradient: 0.12, side: THREE.DoubleSide });
    }
    SHOE_BUILDER[id](raw, mat, secMat ?? mat);
  }
  // M6.5: split the pair into per-foot groups (every shoe piece is a
  // side-offset box). TWO frames per side: the shoe body/sole wraps the
  // FOOT pivot (footL/footR joint) so the shoe stays glued to the foot at
  // any ankle angle; the ankle cuff sits higher on the shin and rides the
  // KNEE joint (kneeL/kneeR) instead — deep bends keep the cuff on the
  // calf while the foot flexes inside it.
  const group = new THREE.Group();
  const wraps = {};
  for (const side of [-1, 1]) {
    const tag = side < 0 ? "L" : "R";
    const footWrap = new THREE.Group();
    footWrap.userData = { clothPart: "foot" + tag };
    const kneeWrap = new THREE.Group();
    kneeWrap.userData = { clothPart: "knee" + tag };
    wraps[side] = { footWrap, kneeWrap };
    group.add(footWrap, kneeWrap);
  }
  for (const mesh of [...raw.children]) {
    if (mesh.userData?.clothPart) {
      group.add(mesh);
      continue;
    }
    const w = wraps[Math.sign(mesh.position.x || 1)];
    (mesh.position.y >= 0.2 ? w.kneeWrap : w.footWrap).add(mesh);
  }
  let tris = 0;
  group.traverse((o) => {
    if (o.isMesh) {
      o.geometry.computeBoundingSphere();
      tris += o.geometry.attributes.position.count / 3;
    }
  });
  if (SHOE_BUILDER[id]) console.log(`[psxcc] ${id}: ${tris} tris (max 150)`);
  return { group, mat, secMat };
}
