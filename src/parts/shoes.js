import * as THREE from "three";
import { makePSXMaterial } from "../psxRenderer.js";

// M4 shoes only (socks slot removed). Shoes are chunky boxes over the base
// feet plus a sole plate and an ankle cuff.
// Feet: 0.32 x 0.18 x 0.44 box at (±0.19, 0.09, 0.08) so top y=0.18.
// Legs: y 0.06..0.62, z half 0.17 -> every shoe part must strictly enclose
// that envelope (no coplanar faces, no poked-through walls).

const SHOE_BUILDER = {
  shoe_sneaker(g, m) {
    for (const side of [-1, 1]) {
      // body: deeper (z half 0.28) so the leg's back face (-0.17) is strictly
      // inside; wider (w half 0.2) so both shoes overlap at the centre
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.2, 0.56).toNonIndexed(), m
      );
      body.position.set(side * 0.19, 0.13, 0.08);
      // sole also encloses the leg bottom (z -0.18 < -0.17)
      const sole = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.07, 0.52).toNonIndexed(), m
      );
      sole.position.set(side * 0.19, 0.035, 0.08);
      // cuff: fully encases the leg box (x half <=0.17, z half 0.17) with
      // margin; the lip (top 0.32) rises above the pant hem (0.3) so the hem
      // tucks into the shoe, and cuffs overlap at the centre (no skin slit)
      const cuff = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.1, 0.44).toNonIndexed(), m
      );
      cuff.position.set(side * 0.19, 0.27, 0);
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
