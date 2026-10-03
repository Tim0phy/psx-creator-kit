import * as THREE from "three";
import { chestDecal, shellGeo, addSleeves } from "./fit.js";

// Outer garments (slot "outer", bigger envelope 1.14, open front so the top
// shows underneath). Builders share the tops.js signatures: (g, m, s, flags,
// fit) and derive every torso dimension from the body profile in fit.

function collarBox(g, m, w = 0.62) {
  const collar = new THREE.Mesh(
    new THREE.BoxGeometry(w, 0.08, 0.4).toNonIndexed(), m
  );
  collar.position.y = 0.3;
  g.add(collar);
}

function frontLapels(g, m) {
  for (const side of [-1, 1]) {
    const lapel = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.52, 0.06).toNonIndexed(), m
    );
    lapel.position.set(side * 0.16, -0.02, 0.2);
    lapel.rotation.z = side * 0.06;
    g.add(lapel);
  }
}

const OPEN = true;

export const OUTER_BUILDER = {
  top_jacket(g, m, _s, f, fit) {
    g.add(new THREE.Mesh(shellGeo(fit.profile, 1.14, f.cropped ? 0.82 : 1, OPEN), m));
    addSleeves(g, m, 1.0, 1.26, fit.profile);
    collarBox(g, m);
    frontLapels(g, m);
  },
  outer_blazer(g, m, s, f, fit) {
    g.add(new THREE.Mesh(shellGeo(fit.profile, 1.14, f.cropped ? 0.82 : 1, OPEN), m));
    addSleeves(g, m, 1.0, 1.26, fit.profile);
    collarBox(g, m, 0.58);
    frontLapels(g, m);
// chest school crest pinned ON the left lapel (in front of it)
    chestDecal(g, "crest", 0.17, 0.17, -0.16, 0.12, 0.245);
    // school tie down the middle
    const tie = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.4, 0.03).toNonIndexed(), s
    );
    tie.position.set(0, 0.1, 0.23);
    g.add(tie);
  },
  outer_denim_jacket(g, m, _s, _f, fit) {
    g.add(new THREE.Mesh(shellGeo(fit.profile, 1.14, 1, OPEN), m));
    addSleeves(g, m, 1.0, 1.26, fit.profile);
    collarBox(g, m);
    frontLapels(g, m);
    // chest flap pockets on both sides
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(0.14, 0.1, 0.03).toNonIndexed(), m
      );
      p.position.set(side * 0.2, 0.1, 0.21);
      g.add(p);
    }
  },
  outer_bomber(g, m, s, f, fit) {
    g.add(new THREE.Mesh(shellGeo(fit.profile, 1.14, f.cropped ? 0.82 : 1, OPEN), m));
    addSleeves(g, m, 1.0, 1.26, fit.profile);
    collarBox(g, m, 0.6);
    // ribbed hem band + bomber zip band
    const hem = new THREE.Mesh(
      new THREE.BoxGeometry(0.72 * fit.hw, 0.09, 0.4).toNonIndexed(), s
    );
    hem.position.set(0, -0.27, 0);
    g.add(hem);
    const zip = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.42, 0.04).toNonIndexed(), s
    );
    zip.position.set(0, -0.02, 0.21);
    g.add(zip);
  },
};
