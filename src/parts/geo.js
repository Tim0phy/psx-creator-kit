import * as THREE from "three";
import { RIG } from "../character.js";

// shared box helper for part builders (r = {x?, y?, z?} rotations in rad)
export function bx(g, m, w, h, d, x, y, z, r = {}) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d).toNonIndexed(), m
  );
  mesh.position.set(x, y, z);
  if (r.z) mesh.rotation.z = r.z;
  if (r.x) mesh.rotation.x = r.x;
  if (r.y) mesh.rotation.y = r.y;
  g.add(mesh);
  return mesh;
}

// M6.5: split a clothing tube's y-range at the true knee joint so the lower
// piece follows the shin when the knee bends. The two pieces overlap around
// the knee and the shin piece nests (0.96 width) inside the thigh piece's
// extension -> no gap when bent, no coplanar z-fighting at rest.
// part names get the side letter appended by the caller (thighL/kneeR/...).
export function kneePieces(y0, y1) {
  const k = RIG.kneeY, over = RIG.kneeOver;
  if (y1 <= k - over) return [{ y0, y1, part: "knee", slim: true }];
  if (y0 >= k) return [{ y0, y1, part: "thigh" }];
  // straddles the knee: thigh piece reaches past the knee (never below the
  // garment's own hem), shin piece nests inside its extension
  return [
    { y0: Math.max(y0, k - over), y1, part: "thigh" },
    { y0, y1: Math.min(y1, k + over), part: "knee", slim: true },
  ];
}
