import * as THREE from "three";
import { makePSXMaterial, SHARED_GRAD } from "./psxRenderer.js";

// Chibi base body (M1): all parts simple tapered boxes / rounded low-poly box.
// M8: two body profiles (female / male). Torso widths follow the existing art
// convention: `hips` = the torso box's lower edge (hip/hem line, y 0.58) and
// `shoulders` = its upper edge (shoulder flare, y 1.18). The female profile
// keeps the exact M1-M6 numbers so the default character stays
// pixel-identical; male broadens the shoulders (0.64 vs 0.66 female art) and
// trims the hem (0.58 vs 0.56) -> a much straighter, more rectangular torso.
// Head size, arm length, leg length, feet and the overall chibi proportions
// are identical in both profiles (triangle budget unchanged, still <= 800).

// body profiles shared with the clothing builders: tops.js / bottoms.js read
// these through bodyFit()/getBodyProfile() instead of hardcoding torso values.
export const BODY_PROFILES = {
  female: {
    label: "Female",
    shoulders: 0.66,   // torso upper (shoulder-flare) edge width
    hips: 0.56,        // torso lower (hip/hem) edge width
    depth: 0.32,       // torso depth (identical for both bodies)
    torsoH: 0.6,       // torso box height
    armX: 0.36,        // arm shoulder pivot x (shoulder edge + 0.03 gap)
    legX: 0.19,        // leg/foot pivot x (unchanged)
    hipsW: 0.56,       // pelvis block (bottoms.js) width at the hem
    hipsTopW: 0.5,     // pelvis block width at the waistband
    hipsDepth: 0.3,    // pelvis block depth (inside the torso depth)
    skirtR: 0.32,      // waistband / skirt mouth radius (inside top shells)
  },
  male: {
    label: "Male",
    shoulders: 0.64,   // broader shoulders than the male hem (0.58)
    hips: 0.58,        // narrower hem -> much straighter torso
    depth: 0.32,
    torsoH: 0.6,
    armX: 0.35,        // follows the (narrower) male shoulder edge
    legX: 0.19,
    hipsW: 0.56,
    hipsTopW: 0.5,
    hipsDepth: 0.3,
    skirtR: 0.32,
  },
};

export function getBodyProfile(type) {
  return BODY_PROFILES[type] ?? BODY_PROFILES.female;
}

// per-body scale helper for the clothing builders. Every factor collapses to
// exactly 1 for the female profile, so all tuned female item numbers are
// reproduced without change.
export function bodyFit(bodyType = "female") {
  const p = getBodyProfile(bodyType);
  return {
    profile: p,
    hw: p.hips / 0.56,        // hem-edge trim scale (knit band, bomber hem...)
    sw: p.shoulders / 0.66,   // shoulder-edge trim scale (off-shoulder band)
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

  // torso: flared trapezoid box, widths from the body profile
  const torso = new THREE.Mesh(
    taperBox(p.hips, p.torsoH, p.depth, p.hips, p.shoulders), skinMat
  );
  torso.position.y = 0.88;
  root.add(torso);

  // arms: A-pose ~25 degrees (pivot follows the profile shoulder edge)
  const armGeo = taperBox(0.27, 0.6, 0.27, 0.27, 0.21);
  const handGeo = new THREE.BoxGeometry(0.3, 0.26, 0.3).toNonIndexed();
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

  // legs (identical in both profiles)
  const legGeo = taperBox(0.34, 0.56, 0.34, 0.34, 0.27);
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
