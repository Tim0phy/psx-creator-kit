import * as THREE from "three";
import { makePSXMaterial } from "../psxRenderer.js";

// M4 shoes only (socks slot removed). Shoes are compact boxes over the base
// feet plus a sole plate and a slim ankle cuff.
// Feet: 0.20 x 0.13 x 0.32 box at (±0.19, 0.065, 0.06) so top y=0.13.
// Legs: y 0.06..0.62, z half 0.17 -> shoe walls must strictly enclose that
// envelope (no coplanar back faces).

const SHOE_BUILDER = {
  shoe_sneaker(g, m) {
    for (const side of [-1, 1]) {
      // body: z back -0.14 strictly inside the leg's back face (-0.17),
      // front 0.26 just past the foot toe (0.22)
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.16, 0.4).toNonIndexed(), m
      );
      body.position.set(side * 0.19, 0.09, 0.06);
      const sole = new THREE.Mesh(
        new THREE.BoxGeometry(0.24, 0.07, 0.4).toNonIndexed(), m
      );
      sole.position.set(side * 0.19, 0.045, 0.06);
      // slim ankle cuff: x half 0.16 covers the leg (<=0.158 at this height),
      // z half 0.18 covers the leg depth (0.17), top 0.25 under the pant hem
      const cuff = new THREE.Mesh(
        new THREE.BoxGeometry(0.32, 0.08, 0.36).toNonIndexed(), m
      );
      cuff.position.set(side * 0.19, 0.21, 0);
      g.add(body, sole, cuff);
    }
  },
};

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
