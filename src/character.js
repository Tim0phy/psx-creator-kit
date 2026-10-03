import * as THREE from "three";
import { makePSXMaterial, SHARED_GRAD } from "./psxRenderer.js";

// Chibi base body (M1): all parts simple tapered boxes / rounded low-poly box.
// M8: two body profiles (female / male) with CLEARLY different silhouettes:
// female = hourglass (slim waist, slimmer hips->shoulders flare, thinner
// arms/legs), male = broad straight chest with chunkier arms/legs. Head size,
// arm/leg length, feet and the overall chibi proportions stay identical
// (body triangle budget still <= 800).

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
    hipsDepth: 0.3,    // block depth (inside the torso depth)
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
    hipsDepth: 0.3,
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

function anchorAt(root, name, x, y, z) {
  const a = new THREE.Group();
  a.name = name;
  a.position.set(x, y, z);
  root.add(a);
  return a;
}

export function createCharacter(bodyType = "female") {
  const p = getBodyProfile(bodyType);
  const root = new THREE.Group();

  const skinMat = makePSXMaterial(DEFAULT_SKIN);
  // torso shares the skin material so cropped tops (M6) expose skin,
  // not the old white M1 shirt
  const footMat = makePSXMaterial("#e6d3c4", { gradient: 0.05 });
  const mats = { skin: skinMat, shirt: skinMat, feet: footMat };

  // head ~1/3 of total height (~1.9 units)
  const head = new THREE.Mesh(roundedHead(), skinMat);
  head.position.y = 1.48;
  root.add(head);

  // torso: profile-curved trapezoid box (hourglass / straight)
  const torso = new THREE.Mesh(torsoGeo(p), skinMat);
  torso.position.y = 0.88;
  root.add(torso);

  // arms: A-pose ~25 degrees; thickness from the profile, pivot unchanged
  const armGeo = taperBox(p.armW, 0.6, p.armW, p.armW, p.armW * 0.777);
  const handW = p.armW * 1.111; // old art ratio: hand 0.3 / arm 0.27
  const handGeo = new THREE.BoxGeometry(handW, 0.26, handW).toNonIndexed();
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    const upper = new THREE.Mesh(armGeo, skinMat);
    upper.position.y = -0.29;
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.y = -0.68;
    arm.add(upper, hand);
    arm.position.set(side * p.armX, 1.18, 0);
    arm.rotation.z = side * 0.2; // ~12 deg outward
    root.add(arm);
  }

  // legs: thickness from the profile; pivots stay at ±legX for shoes/socks
  const legGeo = taperBox(p.legW, 0.56, p.legW, p.legW, p.legW * 0.794);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, skinMat);
    leg.position.set(side * p.legX, 0.34, 0);
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.13, 0.32).toNonIndexed(),
      footMat
    );
    foot.position.set(side * p.legX, 0.065, 0.06);
    root.add(leg, foot);
  }

  root.traverse((o) => {
    if (o.isMesh) o.geometry.computeBoundingSphere();
  });
  SHARED_GRAD.max = root.userData.topY = 1.9;

  // named anchors (M5): accessory slot attachment points
  const hairAnchor = new THREE.Group();
  hairAnchor.position.set(0, 1.48, 0);
  hairAnchor.name = "anchor_head";
  root.add(hairAnchor);

  const neckAnchor = anchorAt(root, "anchor_neck", 0, 1.16, 0);
  // wrists: at the arm/en-hand joint (arm pivot y1.18 - 0.6 down, tilted)
  const wristAnchor = anchorAt(root, "anchor_wrist", 0, 0.59, 0);
  const bagAnchor = anchorAt(root, "anchor_bag", 0, 1.0, 0.05);

  function setSkin(hex) {
    skinMat.uniforms.color.value.set(hex);
  }

  return {
    root, mats, setSkin, hairAnchor, profile: p,
    anchors: {
      head: hairAnchor, neck: neckAnchor,
      wrist: wristAnchor, bag: bagAnchor,
    },
  };
}
