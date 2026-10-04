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

// base sneaker reused by the white variant (main colour only); returns the
// per-side FOOT blobs so variant builders can add their own foot pieces
function footBlob(g, side) {
  // M6.5: foot-fitting pieces (body/sole/toe/strap) are tagged for the ANKLE
  // joint -> they pitch with the auto-leveled foot (walk/run toe-off) and the
  // skin foot can never rotate out of its shoe; cuffs/shafts stay on the shin
  const blob = new THREE.Group();
  blob.userData = { clothPart: side < 0 ? "footL" : "footR" };
  g.add(blob);
  return blob;
}

function sneaker(g, m) {
  const blobs = {};
  for (const side of [-1, 1]) {
    const blob = footBlob(g, side);
    blobs[side] = blob;
    // body: x half 0.18 strictly covers the leg (0.142 at these heights,
    // with side margin), z back -0.19 strictly covers the leg's back face
    // (-0.17), front 0.28 just past the foot toe (0.22)
    bx(blob, m, 0.36, 0.16, 0.47, side * 0.19, 0.09, 0.045);
    bx(blob, m, 0.3, 0.07, 0.43, side * 0.19, 0.045, 0.05);
    // slim ankle cuff: x half 0.18 strictly covers the leg with margin
    // (0.158 max) while inner edges (±0.01) keep a gap between cuffs,
    // z half 0.21 strictly covers the leg depth (0.17), top 0.25 under
    // the pant hem (0.43) — stays on the SHIN frame (untagged)
    bx(g, m, 0.36, 0.08, 0.42, side * 0.19, 0.21, 0);
  }
  return blobs;
}

const SHOE_BUILDER = {
  shoe_sneaker: sneaker,
  shoe_white_sneaker(g, m, s) {
    const blobs = sneaker(g, m);
    // contrasting toe cap + sole stripe in the secondary colour
    bx(blobs[-1], s, 0.3, 0.06, 0.14, -0.19, 0.13, 0.2);
    bx(blobs[-1], s, 0.32, 0.02, 0.44, -0.19, 0.075, 0.05);
    bx(blobs[1], s, 0.3, 0.06, 0.14, 0.19, 0.13, 0.2);
    bx(blobs[1], s, 0.32, 0.02, 0.44, 0.19, 0.075, 0.05);
  },

  // chunky platform: taller sole + body, keeps the sneaker cuff silhouette
  shoe_platform(g, m, s) {
    for (const side of [-1, 1]) {
      const blob = footBlob(g, side);
      bx(blob, s, 0.38, 0.1, 0.5, side * 0.19, 0.055, 0.05); // platform sole
      bx(blob, m, 0.38, 0.18, 0.5, side * 0.19, 0.16, 0.045); // taller body
      bx(g, m, 0.38, 0.08, 0.44, side * 0.19, 0.25, 0); // ankle cuff (shin)
    }
  },
  // flat Mary Jane: thin sole, low body, strap across the instep
  shoe_mary_jane(g, m, s) {
    for (const side of [-1, 1]) {
      const blob = footBlob(g, side);
      bx(blob, m, 0.34, 0.12, 0.46, side * 0.19, 0.08, 0.04);
      bx(blob, s, 0.28, 0.05, 0.44, side * 0.19, 0.03, 0.05); // slim sole
      bx(blob, s, 0.36, 0.03, 0.08, side * 0.19, 0.145, 0.02); // instep strap
      bx(blob, s, 0.05, 0.03, 0.03, side * 0.19, 0.145, -0.05); // buckle
    }
  },
  // knee-high boots: sneaker foot + tall shaft wrapping the leg up to y 0.62;
  // M6.5: the shaft is split at the true knee (thigh band + nested shin band)
  // so bent knees don't rip the shaft off the thigh
  shoe_knee_boots(g, m, s) {
    for (const side of [-1, 1]) {
      const blob = footBlob(g, side);
      bx(blob, m, 0.36, 0.16, 0.47, side * 0.19, 0.09, 0.045);
      bx(blob, s, 0.3, 0.07, 0.43, side * 0.19, 0.045, 0.05);
      const tag = side < 0 ? "L" : "R";
      const thigh = new THREE.Group();
      thigh.userData = { clothPart: "thigh" + tag };
      thigh.add(new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.24, 0.4).toNonIndexed(), m));
      thigh.children[0].position.set(side * 0.19, 0.5, 0); // spans 0.38..0.62
      thigh.add(new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.42).toNonIndexed(), s));
      thigh.children[1].position.set(side * 0.19, 0.59, 0); // fold-over cuff
      const shin = new THREE.Group();
      shin.userData = { clothPart: "knee" + tag };
      shin.add(new THREE.Mesh(new THREE.BoxGeometry(0.384, 0.22, 0.384).toNonIndexed(), m));
      shin.children[0].position.set(side * 0.19, 0.31, 0); // spans 0.2..0.42 (nested)
      g.add(thigh, shin);
    }
  },
};

export function createShoes(id, colors) {
  const raw = new THREE.Group();
  const main = colors.main ?? "#ffffff";
  const mat = makePSXMaterial(main, { gradient: 0.12 });
  let secMat = null;
  if (SHOE_BUILDER[id]) {
    if (colors.secondary) secMat = makePSXMaterial(colors.secondary, { gradient: 0.12 });
    SHOE_BUILDER[id](raw, mat, secMat ?? mat);
  }
  // M6.5: split the pair into per-foot groups (every shoe piece is a
  // side-offset box) so each foot follows its shin/knee joint when posing;
  // pre-tagged pieces (knee-boot shaft halves) already carry their joint
  const group = new THREE.Group();
  const wraps = {};
  for (const side of [-1, 1]) {
    const wrap = new THREE.Group();
    wrap.userData = { clothPart: side < 0 ? "kneeL" : "kneeR" };
    wraps[side] = wrap;
    group.add(wrap);
  }
  for (const mesh of [...raw.children]) {
    if (mesh.userData?.clothPart) {
      group.add(mesh);
      continue;
    }
    wraps[Math.sign(mesh.position.x || 1)].add(mesh);
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
