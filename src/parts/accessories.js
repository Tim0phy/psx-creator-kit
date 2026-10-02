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

// anchor-space builders (root space via main.js)
const BODY_BUILDER = {
  // snug collar hugging the head-torso seam right under the chin (the chibi
  // body has no neck): the band peeks out around the head's bottom rim
  acc_choker(g, m) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.4, 0.4, 0.1, 8, 1, true).toNonIndexed(), m
    );
    band.scale.set(1, 1, 0.9); // oval: wider than the head rim, clears the jaw
    band.position.y = -0.065; // world 1.095: wraps the head bottom rim
    g.add(band);
    const o = new THREE.Mesh(
      new THREE.TorusGeometry(0.04, 0.016, 4, 8).toNonIndexed(), m
    );
    o.position.set(0, -0.11, 0.345); // O-ring charm hanging at the band front
    g.add(o);
  },
  // full bead ring around the base of each hand (below any sleeve end),
  // alternating main/darker beads + one chunky charm bead at the front
  acc_friendship_bracelet(g, m, s) {
    for (const side of [-1, 1]) {
      const cx = side * 0.485, cy = -0.03;
      // ring plane perpendicular to the A-pose arm axis (rz side * 0.2)
      const ax = 0.9801, ay = side * 0.1987;
      for (let i = 0; i < 8; i++) {
        const phi = (i + 0.5) * (Math.PI / 4);
        const bead = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.05), i % 2 ? s : m
        );
        bead.position.set(
          cx + 0.16 * Math.cos(phi) * ax,
          cy + 0.16 * Math.cos(phi) * ay,
          0.16 * Math.sin(phi)
        );
        g.add(bead);
      }
      const charm = new THREE.Mesh(new THREE.OctahedronGeometry(0.075), m);
      charm.position.set(cx, cy, 0.16); // chunky charm bead at the front
      g.add(charm);
    }
  },
};

const ALL = { ...HEAD_BUILDER, ...HEAD2_BUILDER, ...BODY_BUILDER, ...BAG_BUILDER };

export const ACC_IDS = Object.keys(ALL);

export function createAccessory(id, colorHex, fit) {
  const group = new THREE.Group();
  const mat = makePSXMaterial(colorHex, { gradient: 0.12 });
  let secMat = null;
  if (ALL[id]) {
    // darker variant of the main colour for lenses / inner ears
    secMat = makePSXMaterial(colorHex, { gradient: 0.08 });
    secMat.uniforms.color.value.multiplyScalar(0.45);
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
