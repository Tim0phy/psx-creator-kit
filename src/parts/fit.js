import * as THREE from "three";
import { torsoGeo, taperBox } from "../character.js";
import { makePSXMaterial } from "../psxRenderer.js";
import { makeDecal } from "../patterns.js";

// Garment fit helpers for tops/outers (M8 body selector): every torso envelope
// dimension derives from the body profile instead of hard-coded numbers.

// shell around the torso: profile-curved envelope (torsoGeo in character.js
// guarantees the shell encloses the body row by row); hScale lets a cropped
// top end higher. open front for outerwear keeps the top visible underneath.
export function shellGeo(p, enl, hScale = 1, open = false) {
  const g = torsoGeo(p, enl, hScale);
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

// sleeve: tapered box around the arm; cross-section scales with the profile
// arm thickness (old art ratio: sleeve 0.3 / arm 0.27 -> 1.111). len 1 =
// upper arm to elbow, len 1.75 = full sleeve to the wrist. Arms rotate z
// +/-0.2 rad about their group pivot at (±armX, 1.18).
// M6.5: each sleeve container is tagged (clothPart "shoulder" + side) so
// pose.attachCloth re-parents it onto the shoulder joint; the joint's rest
// A-pose (+-0.2) reproduces the old static tilt exactly, so long sleeves
// stop at the elbow and never need splitting.
function sleeveMesh(len, mat, p, enl = 1.08, side = 1) {
  const l = 0.6 * len;
  const sw = (p.armW ?? 0.27) * 1.111;
  const g = taperBox(sw * enl, l, sw * enl, sw * enl, sw * 0.8 * enl)
    .toNonIndexed();
  const m = new THREE.Mesh(g, mat);
  // hang from the shoulder joint (same pivot as the arm group)
  m.position.y = -l / 2;
  const container = new THREE.Group();
  container.add(m);
  container.position.set(0, 0, 0);
  // M6.5: tag with the EXACT joint name (PART_JOINT key); the old static
  // A-pose tilt baked in the container is zeroed by pose.attachCloth so the
  // joint's own rest rotation (side * 0.2) supplies it after re-parenting
  container.userData = { clothPart: "shoulder" + (side < 0 ? "L" : "R"), side };
  return container;
}

export function addSleeves(root, mat, len, enl, p) {
  for (const side of [-1, 1]) {
    const s = sleeveMesh(len, mat, p, enl, side);
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
  const mat = makePSXMaterial("#ffffff", {
    map: tex, gradient: 0.1,
    // same z-fight guard as the face decals (plate mode sits on the shell)
    polygonOffset: true, polygonOffsetFactor: -4,
  });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012).toNonIndexed(), mat);
  m.position.set(x, y, z);
  g.add(m);
  return { tex, mat };
};
