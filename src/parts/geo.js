import * as THREE from "three";

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
