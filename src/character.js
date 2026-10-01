import * as THREE from "three";
import { makePSXMaterial, SHARED_GRAD } from "./psxRenderer.js";

// Chibi base body (M1): all parts simple tapered boxes / rounded low-poly box.
// No face texture, hair, or clothes yet (M2/M3/M4).

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

export function createCharacter() {
  const root = new THREE.Group();

  const skinMat = makePSXMaterial(DEFAULT_SKIN);
  const shirtMat = makePSXMaterial("#ffffff");
  const footMat = makePSXMaterial("#e6d3c4", { gradient: 0.05 });
  const mats = { skin: skinMat, shirt: shirtMat, feet: footMat };

  // head ~1/3 of total height (~1.9 units)
  const head = new THREE.Mesh(roundedHead(), skinMat);
  head.position.y = 1.48;
  root.add(head);

  // torso: flared trapezoid box
  const torso = new THREE.Mesh(taperBox(0.56, 0.6, 0.32, 0.56, 0.66), shirtMat);
  torso.position.y = 0.88;
  root.add(torso);

  // arms: A-pose ~25 degrees
  const armGeo = taperBox(0.27, 0.6, 0.27, 0.27, 0.21);
  const handGeo = new THREE.BoxGeometry(0.3, 0.26, 0.3).toNonIndexed();
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    const upper = new THREE.Mesh(armGeo, skinMat);
    upper.position.y = -0.29;
    const hand = new THREE.Mesh(handGeo, skinMat);
    hand.position.y = -0.68;
    arm.add(upper, hand);
    arm.position.set(side * 0.36, 1.18, 0);
    arm.rotation.z = side * 0.2; // ~12 deg outward
    root.add(arm);
  }

  // legs
  const legGeo = taperBox(0.34, 0.56, 0.34, 0.34, 0.27);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, skinMat);
    leg.position.set(side * 0.19, 0.34, 0);
    const foot = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.13, 0.32).toNonIndexed(),
      footMat
    );
    foot.position.set(side * 0.19, 0.065, 0.06);
    root.add(leg, foot);
  }

  root.traverse((o) => {
    if (o.isMesh) o.geometry.computeBoundingSphere();
  });
  SHARED_GRAD.max = root.userData.topY = 1.9;

  // hair anchor (M3): origin at the head centre
  const hairAnchor = new THREE.Group();
  hairAnchor.position.set(0, 1.48, 0);
  root.add(hairAnchor);

  function setSkin(hex) {
    skinMat.uniforms.color.value.set(hex);
  }

  return { root, mats, setSkin, hairAnchor };
}
