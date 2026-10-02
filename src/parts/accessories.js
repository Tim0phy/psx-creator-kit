import * as THREE from "three";
import { makePSXMaterial } from "../psxRenderer.js";
import { taperBox } from "../character.js";
import { bx } from "./geo.js";
import { BAG_BUILDER } from "./bags.js";
import { DEFAULT_FIT as DF } from "./hair.js";

// M5 accessories: every item from catalog.json, original low-poly geometry.
// Head-space builders (headwear/eyewear) use origin = head centre (y 1.48),
// matching hair.js; all other builders use the matching character anchor.
// Each item gets one colour slot (main); optional darker material for
// lenses/inner ears is returned as secMat.

// Mouth-less headwear builders read fit = { r, top, front } from hair.js so
// each headwear item hugs the CURRENT hairstyle's cap surface (hair_01 fit
// gives the tuned reference numbers: crown r 0.42, base y 0.44).
const HEAD_BUILDER = {
  // pyramids poking out of the hair cap, tilted outward
  acc_cat_ears(g, m, s, fit = DF) {
    const y = fit.top + 0.17, x = fit.r * 0.57;
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.38, 4, 1, true), m
      );
      ear.position.set(side * x, y, 0.05);
      ear.rotation.y = Math.PI / 4;
      ear.rotation.z = side * -0.2;
      g.add(ear);
      const inner = new THREE.Mesh(
        new THREE.ConeGeometry(0.09, 0.24, 4, 1, true), s
      );
      inner.position.set(side * (x + 0.01), y - 0.03, 0.06);
      inner.rotation.y = Math.PI / 4;
      inner.rotation.z = side * -0.2;
      g.add(inner);
    }
  },
  // tall rounded ears with darker inner fronts
  acc_bunny_ears(g, m, s, fit = DF) {
    const y = fit.top + 0.14, x = fit.r * 0.46;
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(taperBox(0.17, 0.46, 0.09, 0.17, 0.11), m);
      ear.position.set(side * x, y, 0.02);
      ear.rotation.z = side * -0.12;
      g.add(ear);
      const inner = new THREE.Mesh(taperBox(0.09, 0.32, 0.02, 0.09, 0.06), s);
      inner.position.set(side * (x + 0.01), y - 0.02, 0.065);
      inner.rotation.z = side * -0.12;
      g.add(inner);
    }
  },
  // slouched dome + rolled brim + pompom — geometries derive from fit so the
  // brim rim hugs the current hair cap outline (crown stays inside it)
  acc_beanie(g, m, s, fit = DF) {
    const crown = new THREE.SphereGeometry(fit.r - 0.095, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    crown.scale(1, 0.72, 0.95);
    crown.translate(0, fit.top + 0.01, 0);
    g.add(new THREE.Mesh(crown.toNonIndexed(), m));
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(fit.r - 0.015, fit.r - 0.015, 0.16, 7, 1, true).toNonIndexed(), m
    );
    band.scale.set(1, 1, 0.95);
    band.position.y = fit.top + 0.04;
    g.add(band);
    const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), m);
    pom.position.set(0, fit.top + 0.27, 0);
    g.add(pom);
  },
  // deep dome crown + base band + flat front brim + top button — the brim
  // tucks under the band so crown/band/brim read as one connected cap
  acc_cap(g, m, s, fit = DF) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(fit.r - 0.015, fit.r - 0.015, 0.13, 6, 1, true).toNonIndexed(), m
    );
    band.scale.set(1, 1, 0.95);
    band.position.y = fit.top + 0.05;
    g.add(band);
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(fit.r - 0.095, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), m
    );
    crown.geometry.scale(1, 0.72, 0.94);
    crown.position.y = fit.top + 0.1;
    g.add(crown);
    // brim back edge (fit.front + 0.02) overlaps the band front (fit.r*0.95)
    bx(g, m, fit.r * 1.18, 0.06, 0.28, 0, fit.top + 0.02, fit.front + 0.09);
    bx(g, m, 0.08, 0.06, 0.08, 0, fit.top + 0.33, 0);
  },
  // puffy crown + deep band + short visor
  acc_bakerboy(g, m, s, fit = DF) {
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(fit.r - 0.095, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), m
    );
    crown.geometry.scale(1, 0.42, 0.94);
    crown.position.y = fit.top + 0.06;
    g.add(crown);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(fit.r - 0.015, fit.r - 0.015, 0.17, 8, 1, true).toNonIndexed(), m
    );
    band.scale.set(1, 1, 0.95);
    band.position.y = fit.top + 0.05;
    g.add(band);
    // visor back edge (fit.front - 0.02) overlaps the band front (fit.r*0.95)
    bx(g, m, fit.r * 0.93, 0.05, 0.22, 0, fit.top + 0.05, fit.front + 0.09);
  },
  // butterfly wing pairs on both sides of the head
  acc_butterfly_clip(g, m, s, fit = DF) {
    const dy = fit.top - 0.43, x = fit.r * 0.93;
    for (const side of [-1, 1]) {
      bx(g, m, 0.2, 0.09, 0.03, side * x, 0.24 + dy, 0.1, { z: side * 0.55 });
      bx(g, m, 0.15, 0.08, 0.03, side * (x + 0.01), 0.16 + dy, 0.1, { z: side * -0.55 });
      bx(g, m, 0.05, 0.12, 0.05, side * (fit.r * 0.82), 0.2 + dy, 0.11);
      bx(g, m, 0.05, 0.07, 0.04, side * (fit.r * 0.82), 0.11 + dy, 0.1);
    }
  },
  // the original Z logo: three bars across the forehead (Y2K headband)
  acc_z_hairband(g, m, s, fit = DF) {
    const z = fit.front + 0.015, y = fit.top + 0.07;
    bx(g, m, 0.46, 0.07, 0.05, 0, y, z);
    bx(g, m, 0.09, 0.44, 0.05, 0, y - 0.19, z, { z: -0.48 });
    bx(g, m, 0.46, 0.07, 0.05, 0, y - 0.38, z);
  },
};

const HEAD2_BUILDER = {
  // round frames + darker lenses + temple arms
  acc_glasses(g, m, s) {
    for (const side of [-1, 1]) {
      const lx = side * 0.16;
      for (const [w, h, dx, dy] of [
        [0.26, 0.04, 0, 0.09], [0.26, 0.04, 0, -0.12],
        [0.04, 0.2, side * 0.12, -0.01],
      ]) {
        bx(g, m, w, h, 0.05, lx + dx, -0.02 + dy, 0.44);
      }
      const lens = new THREE.Mesh(
        new THREE.BoxGeometry(0.2, 0.16, 0.005).toNonIndexed(), s
      );
      lens.position.set(lx, -0.02, 0.406);
      g.add(lens);
    }
    bx(g, m, 0.1, 0.035, 0.04, 0, 0.07, 0.44);
    for (const side of [-1, 1]) {
      bx(g, m, 0.035, 0.035, 0.34, side * 0.33, -0.02, 0.25);
    }
  },
  // one band wrapping around the whole head, thicker darker front visor arc —
  // worn over the hair (clears the 0.475 hair shell), short arc keeps the
  // visor ends off the hair sides
  acc_wrap_sunglasses(g, m, s) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.51, 0.51, 0.16, 10, 1, true).toNonIndexed(), m
    );
    band.scale.set(1, 1, 0.94);
    band.position.y = -0.04;
    g.add(band);
    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.53, 0.53, 0.15, 6, 1, true, -0.75, 1.5)
        .toNonIndexed(), s
    );
    visor.scale.set(1, 1, 0.94);
    visor.position.y = -0.04;
    g.add(visor);
  },
};

// rounded-rect outline (halves hx/hz, corner chamfer r) as a Shape/Path —
// used to build a band whose cross-section matches a boxy body part
function roundedRectPath(p, hx, hz, r) {
  p.moveTo(-hx + r, -hz);
  p.lineTo(hx - r, -hz);
  p.quadraticCurveTo(hx, -hz, hx, -hz + r);
  p.lineTo(hx, hz - r);
  p.quadraticCurveTo(hx, hz, hx - r, hz);
  p.lineTo(-hx + r, hz);
  p.quadraticCurveTo(-hx, hz, -hx, hz - r);
  p.lineTo(-hx, -hz + r);
  p.quadraticCurveTo(-hx, -hz, -hx + r, -hz);
}

// anchor-space builders (root space via main.js)
const BODY_BUILDER = {
  // squared choker: rounded-rect tube matching the head's boxy base rim
  // (flats x 0.373 / z 0.334, corners ~0.06-0.075) instead of an ellipse —
  // constant small gap on all four flats and corners, so it reads as a
  // collar squeezed onto the body from every angle
  acc_choker(g, m) {
    const shape = new THREE.Shape();
    roundedRectPath(shape, 0.385, 0.345, 0.04);
    const hole = new THREE.Path();
    roundedRectPath(hole, 0.35, 0.31, 0.02);
    shape.holes.push(hole);
    const band = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.07, bevelEnabled: false, curveSegments: 1,
      }).rotateX(-Math.PI / 2), m
    );
    band.position.y = -0.075; // extruded 0..0.07 tall: world 1.085-1.155
    g.add(band);
    const o = new THREE.Mesh(
      new THREE.TorusGeometry(0.04, 0.016, 4, 8).toNonIndexed(), m
    );
    o.position.set(0, -0.085, 0.37); // O-ring charm mounted at the band front
    g.add(o);
  },
  // wristwatch on the left hand (screen-left = -x, model's right wrist in
  // A-pose story terms users read as "left hand"): rounded-rect strap with
  // the same boxiness as the arms, white fixed dial, case/strap colourable
  acc_watch(g, m, s) {
    // everything is built in one arm-tilted frame: translate to the wrist
    // centre then rotate with the A-pose arm (rz -0.2) so strap, case and
    // dial share one coordinate space and can never drift apart
    const frame = new THREE.Group();
    frame.position.set(-0.485, -0.045, 0);
    frame.rotation.z = -0.2;
    g.add(frame);
    // strap: rounded-rect tube around the wrist, extruded along the arm axis
    // (frame-local y 0..0.075); ring cross-section halves x 0.185 / z 0.165
    const shape = new THREE.Shape();
    roundedRectPath(shape, 0.185, 0.165, 0.04);
    const hole = new THREE.Path();
    roundedRectPath(hole, 0.15, 0.13, 0.03);
    shape.holes.push(hole);
    const strap = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: 0.075, bevelEnabled: false, curveSegments: 1,
      }).rotateX(-Math.PI / 2), s
    );
    frame.add(strap);
    // case: chunky box flush-mounted on the strap's OUTER flat (-x), sized
    // to the band (0.09 tall vs strap 0.075) so the two read as one piece;
    // dial inset on the case face, hands on the dial, crown on the -z edge
    bx(frame, m, 0.05, 0.09, 0.15, -0.18, 0.0375, 0);
    bx(frame, m, 0.026, 0.026, 0.026, -0.175, 0.0375, -0.09);
    const dial = bx(frame, m, 0.014, 0.07, 0.12, -0.205, 0.0375, 0);
    dial.material = makePSXMaterial("#ffffff", { gradient: 0.08 });
    // hands: dark bars on the dial face (dial faces -x outward)
    bx(frame, s, 0.014, 0.045, 0.02, -0.213, 0.047, 0);
    bx(frame, s, 0.014, 0.02, 0.04, -0.213, 0.028, 0.015);
  },
};

const ALL = { ...HEAD_BUILDER, ...HEAD2_BUILDER, ...BODY_BUILDER, ...BAG_BUILDER };

export const ACC_IDS = Object.keys(ALL);

export function createAccessory(id, colors, fit) {
  const group = new THREE.Group();
  const main = colors.main ?? "#ffffff";
  const mat = makePSXMaterial(main, { gradient: 0.12 });
  let secMat = null;
  if (ALL[id]) {
    // secondary slot (watch strap): user-coloured; darker variant of main
    // otherwise as before for lenses/inner ears
    if (colors.secondary) {
      secMat = makePSXMaterial(colors.secondary, { gradient: 0.12 });
    } else {
      secMat = makePSXMaterial(main, { gradient: 0.08 });
      secMat.uniforms.color.value.multiplyScalar(0.45);
    }
    ALL[id](group, mat, secMat, fit);
  }
  let tris = 0;
  group.traverse((o) => {
    if (o.isMesh) {
      o.geometry.computeBoundingSphere();
      tris += o.geometry.attributes.position.count / 3;
    }
  });
  if (ALL[id]) console.log(`[psxcc] ${id}: ${tris} tris (max 150)`);
  return { group, mat, secMat };
}
