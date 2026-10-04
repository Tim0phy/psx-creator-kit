import * as THREE from "three";
import { makePSXMaterial, SHARED_GRAD } from "./psxRenderer.js";

// Chibi base body (M1): all parts simple tapered boxes / rounded low-poly box.
// M8: two body profiles (female / male) with CLEARLY different silhouettes:
// female = hourglass (slim waist, slimmer hips->shoulders flare, thinner
// arms/legs), male = broad straight chest with chunkier arms/legs. Head size,
// arm/leg length, feet and the overall chibi proportions stay identical
// (body triangle budget still <= 800).
// M6.5: every part hangs from a named THREE.Group pivot chain (no skinning):
//   root -> hips -> waist -> chest -> neck -> head
//   chest -> shoulderL/R -> elbowL/R (hand)   |   hips -> thighL/R -> kneeL/R
// -> footL/R. Rest transforms reproduce the old static layout exactly; pose.js
// only ever rotates these pivots (fixed order, clamped).

// rig constants shared with the clothing builders (parts/* split tubes/socks
// at the knee so garments follow the limbs)
export const RIG = {
  hipsY: 0.58,     // hip/pelvis line (bottoms hips block, skirts)
  waistY: 0.88,    // torso centre = waist twist pivot
  chestY: 1.18,    // shoulder line (torso top)
  shoulderY: 1.18,
  thighTopY: 0.62, // top of the thigh (true hip joint)
  kneeY: 0.34,     // true knee joint (leg pieces cut here)
  kneeOver: 0.05,  // clothes overlap margin around the knee cut
  armRest: 0.2,    // A-pose shoulder rest (rad, per side)
  topY: 1.9,       // gradient ceiling (SHARED_GRAD)
};

// torso width curve, shared with the clothing shells so garments always
// enclose the body exactly: t = 0 at the hip/hem line (y 0.58), 1 at the
// shoulder line (y 1.18); the waist pinch sits at profile.waistY.
export function torsoW(t, p) {
  const wY = p.waistY;
  return t < wY
    ? p.hips + (p.waist - p.hips) * (t / wY)
    : p.waist + (p.shoulders - p.waist) * ((t - wY) / (1 - wY));
}

// tapered torso box sampled on `seg` height rows; enl scales the whole
// envelope (clothing shells); hScale < 1 crops from the bottom (hem rises,
// shoulder row unchanged) for cropped tops.
export function torsoGeo(p, enl = 1, hScale = 1) {
  const h = p.torsoH * hScale;
  const base = p.shoulders * enl; // widest row -> scale factor 1
  const d = p.depth * enl;
  const g = new THREE.BoxGeometry(base, h, d, 1, p.torsoSeg ?? 4, 1)
    .toNonIndexed();
  const q = g.attributes.position;
  for (let i = 0; i < q.count; i++) {
    const t = (q.getY(i) + h / 2) / h;
    const tb = 1 - (1 - t) * hScale; // shell row -> body height fraction
    q.setX(i, q.getX(i) * ((torsoW(tb, p) * enl) / base));
  }
  g.computeVertexNormals();
  return g;
}

// body profiles shared with the clothing builders: tops.js / bottoms.js read
// these through getBodyProfile()/bodyFit() instead of hardcoding torso values.
export const BODY_PROFILES = {
  female: {
    label: "Female",
    shoulders: 0.58,   // shoulder-line width (slim, feminine)
    waist: 0.5,        // hourglass waist pinch
    hips: 0.6,         // hip/hem line (wider than the shoulders)
    waistY: 0.42,      // waist height fraction (0 = hem, 1 = shoulders)
    depth: 0.32,       // torso depth (same for both bodies)
    torsoH: 0.6,
    torsoSeg: 5,
    armX: 0.36,        // arm shoulder pivot x (unchanged: wrists stay aligned)
    armW: 0.22,        // slim arms
    legX: 0.19,        // leg pivot x (shoes/socks are tuned to +-0.19)
    legW: 0.28,        // slim legs
    hipsW: 0.5,        // pelvis block (bottoms.js) width at the hem
    hipsTopW: 0.44,    // block width at the waistband (inside the slim waist)
    tubeR: 0.34,       // pant-tube width (slim, hugs the hips silhouette)
    tubeD: 0.4,        // pant-tube depth (encloses the top shell hem)
    hipsDepth: 0.36,   // block depth: deeper than the shell hem so the waist
                       // reads continuously through the tube slit
    skirtR: 0.32,      // waistband / skirt mouth radius
  },
  male: {
    label: "Male",
    shoulders: 0.66,   // broad straight chest
    waist: 0.6,        // nearly straight sides
    hips: 0.62,
    waistY: 0.45,
    depth: 0.32,
    torsoH: 0.6,
    torsoSeg: 5,
    armX: 0.35,
    armW: 0.3,         // chunky arms
    legX: 0.19,
    legW: 0.34,        // chunky legs
    hipsW: 0.56,
    hipsTopW: 0.52,
    tubeR: 0.42,       // wide straight pant tubes
    tubeD: 0.42,       // pant-tube depth
    hipsDepth: 0.3,    // block depth (inside the torso depth)
    skirtR: 0.32,
  },
};

export function getBodyProfile(type) {
  return BODY_PROFILES[type] ?? BODY_PROFILES.female;
}

// per-body scale helper for the clothing builders: hem/shoulder/waist-anchored
// trim scales. All collapse to 1 at the old art values.
export function bodyFit(bodyType = "female") {
  const p = getBodyProfile(bodyType);
  return {
    profile: p,
    hw: p.hips / 0.56,        // hem-edge trim scale (knit band, bomber hem)
    sw: p.shoulders / 0.66,   // shoulder-edge trim scale (off-shoulder band)
    ww: p.waist / 0.56,       // waist-anchored trims (low-rise mini skirt)
    tw: p.tubeR / 0.42,       // pant-tube width scale (1 = male/old art)
    td: p.tubeD / 0.42,       // pant-tube depth scale
    wr: p.skirtR / 0.32,      // skirt/waistband mouth scale
  };
}

export function taperBox(w, h, d, topW, botW) {
  const g = new THREE.BoxGeometry(w, h, d, 1, 1, 1).toNonIndexed();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = (p.getY(i) + h / 2) / h;
    const s = (topW + (botW - topW) * t) / w;
    p.setX(i, p.getX(i) * s);
  }
  g.computeVertexNormals();
  return g;
}

function roundedHead() {
  const g = new THREE.BoxGeometry(0.82, 0.8, 0.72, 3, 3, 2).toNonIndexed();
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    const r = 0.44;
    // keep the centre of the front/back faces flat so the face plate sits
    // flush on the head; the flat region must cover the whole face plate
    // (plate is 0.5 x 0.44)
    const flat = Math.abs(v.x) < 0.32 && Math.abs(v.y) < 0.27;
    const s = flat ? 0.03 : 0.38;
    v.normalize().multiplyScalar(r);
    p.setXYZ(
      i,
      p.getX(i) * (1 - s) + v.x * s,
      p.getY(i) * (1 - s) + v.y * s,
      p.getZ(i) * (1 - s) + v.z * s
    );
  }
  g.computeVertexNormals();
  return g;
}

export const DEFAULT_SKIN = "#f5d5bf";

function anchorAt(parent, name, x, y, z) {
  const a = new THREE.Group();
  a.name = name;
  a.position.set(x, y, z);
  parent.add(a);
  return a;
}

export function createCharacter(bodyType = "female") {
  const p = getBodyProfile(bodyType);
  const root = new THREE.Group();
  root.rotation.order = "YXZ"; // fixed order: yaw (controls) then tilt (pose)

  const skinMat = makePSXMaterial(DEFAULT_SKIN);
  // torso shares the skin material so cropped tops (M6) expose skin,
  // not the old white M1 shirt
  const footMat = makePSXMaterial("#e6d3c4", { gradient: 0.05 });
  const mats = { skin: skinMat, shirt: skinMat, feet: footMat };

  // named joint pivots (M6.5): plain groups, no skinning, clamped by pose.js
  const joints = {};
  function joint(name, parent, x, y, z, order) {
    const g = new THREE.Group();
    g.name = "j_" + name;
    g.position.set(x, y, z);
    if (order) g.rotation.order = order;
    parent.add(g);
    joints[name] = g;
    return g;
  }

  const hips = joint("hips", root, 0, RIG.hipsY, 0);
  const waist = joint("waist", hips, 0, 0.30, 0, "ZXY");
  const chest = joint("chest", waist, 0, 0.30, 0);
  const neck = joint("neck", chest, 0, -0.02, 0, "ZXY");
  const head = joint("head", neck, 0, 0.32, 0);

  // torso mesh: waist-local -0.30 -> world 0.88 exactly as before
  const torso = new THREE.Mesh(torsoGeo(p), skinMat);
  torso.position.y = -0.30;
  waist.add(torso);

  // head + anchor_head: rest world (0,1.48,0) unchanged; hair / face decals /
  // headwear / eyewear keep their head-centred coordinate space untouched
  const headMesh = new THREE.Mesh(roundedHead(), skinMat);
  head.add(headMesh);
  const hairAnchor = new THREE.Group();
  hairAnchor.name = "anchor_head";
  head.add(hairAnchor);

  // arms: shoulder pivot = true shoulder joint (world ±armX, 1.18); elbow
  // pivot at the arm/hand seam (world y 0.60 at rest, under the sleeve hem)
  const armGeo = taperBox(p.armW, 0.6, p.armW, p.armW, p.armW * 0.777);
  const handW = p.armW * 1.111; // old art ratio: hand 0.3 / arm 0.27
  const handGeo = new THREE.BoxGeometry(handW, 0.26, handW).toNonIndexed();
  for (const side of [-1, 1]) {
    const n = side < 0 ? "L" : "R";
    const sh = joint("shoulder" + n, chest, side * p.armX, 0, 0, "ZXY");
    sh.rotation.z = side * RIG.armRest; // rest A-pose ~12 deg (unchanged M1)
    const upper = new THREE.Mesh(armGeo, skinMat);
    upper.position.y = -0.29;
    sh.add(upper);
    const elbow = joint("elbow" + n, sh, 0, -0.58, 0, "ZXY");
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.y = -0.10; // old hand offset (-0.68) relative the elbow
    elbow.add(hand);
  }

  // legs: single 0.56 taper split at the true knee (y 0.34) into thigh+shin;
  // both pieces share the continuous taper profile -> seamless at rest,
  // triangle count +12 per leg (body budget stays <= 800)
  const halfT = 0.897; // taper width factor at the knee (0.5 of the old run)
  const thighGeo = taperBox(p.legW, 0.28, p.legW, p.legW * halfT, p.legW * 0.794);
  const shinGeo = taperBox(p.legW, 0.28, p.legW, p.legW, p.legW * halfT);
  const footGeo = new THREE.BoxGeometry(0.2, 0.13, 0.32).toNonIndexed();
  for (const side of [-1, 1]) {
    const n = side < 0 ? "L" : "R";
    const thigh = joint("thigh" + n, hips, side * p.legX, 0.04, 0, "ZXY");
    const tm = new THREE.Mesh(thighGeo, skinMat);
    tm.position.y = -0.14; // spans world 0.34..0.62 (old upper half)
    thigh.add(tm);
    const kneeG = joint("knee" + n, thigh, 0, -0.28, 0, "ZXY");
    const sm = new THREE.Mesh(shinGeo, skinMat);
    sm.position.y = -0.14; // spans world 0.06..0.34 (old lower half)
    kneeG.add(sm);
    const foot = joint("foot" + n, kneeG, 0, -0.28, 0);
    const fm = new THREE.Mesh(footGeo, footMat);
    fm.position.set(0, 0.005, 0.06);
    foot.add(fm);
  }

  root.traverse((o) => {
    if (o.isMesh) o.geometry.computeBoundingSphere();
  });
  SHARED_GRAD.max = root.userData.topY = RIG.topY;

  // named anchors (M5), now children of the matching joints so accessories
  // follow the pose; local offsets reproduce the old root-space positions:
  // neck world 1.16 (below the head-turn pivot), bag world (0,1.0,0.05)
  const neckAnchor = anchorAt(chest, "anchor_neck", 0, -0.02, 0);
  const bagAnchor = anchorAt(chest, "anchor_bag", 0, -0.18, 0.05);
  // wrist: keep the old root-space rest transform (0,0.59,0) but parent it
  // to the left elbow via attach() -> rest-identical, follows the forearm.
  // The +0.2 local counter-rotation (from attach) cancels the elbow's rest
  // tilt so the watch builder's baked -0.2 frame renders exactly as before.
  const wristAnchor = anchorAt(root, "anchor_wrist", 0, 0.59, 0);
  root.updateMatrixWorld(true);
  joints.elbowL.attach(wristAnchor);

  function setSkin(hex) {
    skinMat.uniforms.color.value.set(hex);
  }

  function resetRest() {
    // pose.js calls this before (re)attaching garments: exact M1/M8 rest
    root.rotation.x = 0;
    hips.position.y = RIG.hipsY;
    for (const n of [
      "waist", "neck", "shoulderL", "shoulderR",
      "elbowL", "elbowR", "thighL", "thighR", "kneeL", "kneeR",
    ]) {
      joints[n].rotation.set(0, 0, 0);
    }
    joints.shoulderL.rotation.z = -RIG.armRest;
    joints.shoulderR.rotation.z = RIG.armRest;
  }

  return {
    root, mats, setSkin, hairAnchor, profile: p, joints, resetRest,
    anchors: {
      head: hairAnchor, neck: neckAnchor,
      wrist: wristAnchor, bag: bagAnchor,
    },
  };
}
