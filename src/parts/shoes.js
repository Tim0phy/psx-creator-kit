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
      // body: z back -0.18 strictly covers the leg's back face (-0.17);
      // compact footprint so wide pant hems (outer ~0.395) fall straight
      // over the shoe (wide-leg silhouette)
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, 0.2, 0.52).toNonIndexed(), m
      );
      body.position.set(side * 0.19, 0.13, 0.08);
      // sole also encloses the leg bottom (z -0.18 < -0.17)
      const sole = new THREE.Mesh(
        new THREE.BoxGeometry(0.36, 0.07, 0.52).toNonIndexed(), m
      );
      sole.position.set(side * 0.19, 0.035, 0.08);
      // cuff: slim ankle collar (z half 0.19 just inside the pant hem's z
      // half ~0.2, so nothing peeks through the tube slit); top 0.29 stays
      // under the hem 0.3 so pants read straight to the shoe front
      const cuff = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.09, 0.38).toNonIndexed(), m
      );
      cuff.position.set(side * 0.19, 0.245, 0);
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
