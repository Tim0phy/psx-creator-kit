import * as THREE from "three";
import { taperBox } from "../character.js";
import { makePSXMaterial } from "../psxRenderer.js";
import { makeDecal } from "../patterns.js";

// Garment fit helpers for tops/outers (M8 body selector): every torso envelope
// dimension derives from the body profile instead of hard-coded numbers. The
// female profile reproduces the previous hard-coded values exactly, so the
// tuned female items stay visually identical.

// shell around the torso, flared like the body; hScale lets a cropped top
// end higher. open front for outerwear keeps the top visible underneath.
export function shellGeo(p, enl, hScale = 1, open = false) {
  const lo = p.hips * enl, hi = p.shoulders * enl, d = p.depth * enl;
  const h = p.torsoH * hScale;
  const g = taperBox(lo, h, d, lo, hi).toNonIndexed();
  if (hScale < 1) {
    // move the shortened shell up so it hangs from the shoulders down
    g.translate(0, (p.torsoH - h) / 2, 0);
  }
  if (!open) return g;
  // open front: drop the front plate (normals facing +z) so the top shows
  g.computeVertexNormals();
  const q = g.attributes.position;
  const n = g.attributes.normal;
  const keep = [];
  for (let t = 0; t < q.count; t += 3) {
    if (n.getZ(t) > 0.5) continue;
    for (let k = 0; k < 3; k++) keep.push(q.getX(t+k), q.getY(t+k), q.getZ(t+k));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(keep, 3));
  out.computeVertexNormals();
  return out;
}

// sleeve: tapered box around the arm. len 1 = upper arm to elbow,
// len 1.75 = full sleeve to the wrist. Arms rotate z +/-0.2 rad about their
// group pivot at (±armX, 1.18) — pivot x follows the body profile.
function sleeveMesh(len, mat, enl = 1.08) {
  const l = 0.6 * len;
  const g = taperBox(0.3 * enl, l, 0.3 * enl, 0.3 * enl, 0.24 * enl)
    .toNonIndexed();
  const m = new THREE.Mesh(g, mat);
  // hang from the shoulder joint (same pivot as the arm group)
  m.position.y = -l / 2;
  const container = new THREE.Group();
  container.add(m);
  container.position.set(0, 0, 0);
  container.userData.spin = true;
  return container;
}

export function addSleeves(root, mat, len, enl, p) {
  for (const side of [-1, 1]) {
    const s = sleeveMesh(len, mat, enl);
    s.position.set(side * (p.armX ?? 0.36), 0.3, 0);
    s.rotation.z = side * 0.2;
    root.add(s);
  }
}

export function neckTrim(mat) {
  const g = new THREE.BoxGeometry(0.2, 0.06, 0.18).toNonIndexed();
  const m = new THREE.Mesh(g, mat);
  m.position.set(0, 0.32, 0.03);
  return m;
}

// square chest decal (transparent 32x32 canvas on a thin plate)
export function chestDecal(g, kind, w = 0.2, h = 0.2, x = 0, y = 0.06, z = 0.19) {
  const tex = makeDecal(kind);
  const mat = makePSXMaterial("#ffffff", { map: tex, gradient: 0.1 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012).toNonIndexed(), mat);
  m.position.set(x, y, z);
  g.add(m);
  return { tex, mat };
};
