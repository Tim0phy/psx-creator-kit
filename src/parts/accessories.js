import * as THREE from "three";
import { makePSXMaterial } from "../psxRenderer.js";
import { taperBox } from "../character.js";

// M5 accessories: every item from catalog.json, original low-poly geometry.
// Head-space builders (headwear/eyewear) use origin = head centre (y 1.48),
// matching hair.js; all other builders use the matching character anchor.
// Each item gets one colour slot (main); optional darker material for
// lenses/inner ears is returned as secMat.

function bx(g, m, w, h, d, x, y, z, r = {}) {
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

function ring(g, m, r, h, seg, y, z = 0) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, h, seg, 1, true).toNonIndexed(), m
  );
  mesh.position.set(0, y, z);
  g.add(mesh);
  return mesh;
}

// flat 4-point sparkle star (pointer finger star decal)
function starGeo(r, w) {
  const p = [];
  const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
  for (let i = 0; i < 4; i++) {
    const a = dirs[i], b = dirs[(i + 1) % 4];
    p.push(0, 0, 0.02, a[0] * r, a[1] * r, 0.02, (a[0] + b[0]) * w, (a[1] + b[1]) * w, 0.02);
    p.push(0, 0, -0.02, (a[0] + b[0]) * w, (a[1] + b[1]) * w, -0.02, a[0] * r, a[1] * r, -0.02);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

function star(g, m, x, y, z) {
  const s = new THREE.Mesh(starGeo(0.07, 0.025), m);
  s.position.set(x, y, z);
  g.add(s);
}

const HEAD_BUILDER = {
  // pyramids poking out of the hair cap, tilted outward
  acc_cat_ears(g, m, s) {
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(
        new THREE.ConeGeometry(0.16, 0.38, 4, 1, true), m
      );
      ear.position.set(side * 0.27, 0.6, 0.05);
      ear.rotation.y = Math.PI / 4;
      ear.rotation.z = side * -0.2;
      g.add(ear);
      const inner = new THREE.Mesh(
        new THREE.ConeGeometry(0.09, 0.24, 4, 1, true), s
      );
      inner.position.set(side * 0.28, 0.57, 0.06);
      inner.rotation.y = Math.PI / 4;
      inner.rotation.z = side * -0.2;
      g.add(inner);
    }
  },
  // tall rounded ears with darker inner fronts
  acc_bunny_ears(g, m, s) {
    for (const side of [-1, 1]) {
      const ear = new THREE.Mesh(taperBox(0.17, 0.46, 0.09, 0.17, 0.11), m);
      ear.position.set(side * 0.22, 0.57, 0.02);
      ear.rotation.z = side * -0.12;
      g.add(ear);
      const inner = new THREE.Mesh(taperBox(0.09, 0.32, 0.02, 0.09, 0.06), s);
      inner.position.set(side * 0.23, 0.55, 0.065);
      inner.rotation.z = side * -0.12;
      g.add(inner);
    }
  },
  // slouched dome + rolled brim + pompom (all above the hair cap top)
  acc_beanie(g, m) {
    const hat = new THREE.Group();
    const crown = new THREE.SphereGeometry(0.46, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2);
    crown.scale(1, 0.8, 0.94);
    crown.translate(0, 0.32, 0);
    hat.add(new THREE.Mesh(crown.toNonIndexed(), m));
    ring(hat, m, 0.5, 0.15, 7, 0.32);
    const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 0), m);
    pom.position.set(0, 0.76, 0);
    hat.add(pom);
    hat.rotation.x = -0.08;
    g.add(hat);
  },
  // deep dome crown + flat front brim + top button
  acc_cap(g, m) {
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.53, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), m
    );
    crown.geometry.scale(1, 0.8, 0.92);
    crown.position.y = 0.26;
    g.add(crown);
    bx(g, m, 0.44, 0.05, 0.24, 0, 0.28, 0.5);
    bx(g, m, 0.08, 0.06, 0.08, 0, 0.7, 0);
  },
  // puffy crown + deep band + short visor
  acc_bakerboy(g, m) {
    const crown = new THREE.Mesh(
      new THREE.SphereGeometry(0.5, 8, 3, 0, Math.PI * 2, 0, Math.PI / 2), m
    );
    crown.geometry.scale(1, 0.5, 0.94);
    crown.position.y = 0.3;
    g.add(crown);
    ring(g, m, 0.52, 0.16, 8, 0.28);
    bx(g, m, 0.3, 0.04, 0.2, 0, 0.24, 0.5);
  },
  // butterfly wing pairs on both sides of the head
  acc_butterfly_clip(g, m) {
    for (const side of [-1, 1]) {
      bx(g, m, 0.2, 0.09, 0.03, side * 0.44, 0.24, 0.1, { z: side * 0.55 });
      bx(g, m, 0.15, 0.08, 0.03, side * 0.45, 0.16, 0.1, { z: side * -0.55 });
      bx(g, m, 0.05, 0.12, 0.05, side * 0.39, 0.2, 0.11);
      bx(g, m, 0.05, 0.07, 0.04, side * 0.39, 0.11, 0.1);
    }
  },
  // slim clip bars with two sparkle stars each
  acc_sparkle_clip(g, m) {
    for (const side of [-1, 1]) {
      bx(g, m, 0.14, 0.03, 0.03, side * 0.42, 0.24, 0.16, { z: side * 0.2 });
      star(g, m, side * 0.4, 0.31, 0.17);
      star(g, m, side * 0.44, 0.18, 0.17);
    }
  },
  // the original Z logo: three bars across the forehead (Y2K headband)
  acc_z_hairband(g, m) {
    bx(g, m, 0.46, 0.07, 0.05, 0, 0.5, 0.44);
    bx(g, m, 0.09, 0.44, 0.05, 0, 0.31, 0.44, { z: -0.48 });
    bx(g, m, 0.46, 0.07, 0.05, 0, 0.12, 0.44);
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
  // chunky oversized frames, no visible lens rim at the bottom
  acc_big_sunglasses(g, m, s) {
    for (const side of [-1, 1]) {
      const lx = side * 0.17;
      for (const [w, h, dx, dy] of [
        [0.32, 0.06, 0, 0.11], [0.05, 0.28, side * 0.15, -0.01],
        [0.05, 0.28, side * 0.04, -0.01],
      ]) {
        bx(g, m, w, h, 0.06, lx + dx, -0.02 + dy, 0.44);
      }
      const lens = new THREE.Mesh(
        new THREE.BoxGeometry(0.26, 0.24, 0.005).toNonIndexed(), s
      );
      lens.position.set(lx, -0.03, 0.402);
      g.add(lens);
    }
    bx(g, m, 0.08, 0.05, 0.05, 0, 0.08, 0.44);
    for (const side of [-1, 1]) {
      bx(g, m, 0.035, 0.035, 0.3, side * 0.35, 0.0, 0.26);
    }
  },
  // one band wrapping around the whole head, thicker darker front visor arc
  acc_wrap_sunglasses(g, m, s) {
    ring(g, m, 0.5, 0.18, 10, -0.02);
    const visor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.53, 0.53, 0.2, 6, 1, true, -0.9, 1.8)
        .toNonIndexed(), s
    );
    visor.position.y = -0.02;
    g.add(visor);
  },
};

// anchor-space builders (root space via main.js)
const BODY_BUILDER = {
  // snug collar right under the chin (no neck: wrap the head-torso seam)
  acc_choker(g, m) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 0.1, 8, 1, true).toNonIndexed(), m
    );
    band.scale.set(1, 1, 0.95); // oval: clears the chin, hugs the neck
    band.position.y = 0.06;
    g.add(band);
    const o = new THREE.Mesh(
      new THREE.TorusGeometry(0.05, 0.018, 4, 8).toNonIndexed(), m
    );
    o.position.set(0, 0.05, 0.42);
    g.add(o);
  },
  // relaxed band + V chain + sparkle pendant
  acc_pendant(g, m) {
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(0.43, 0.43, 0.05, 8, 1, true).toNonIndexed(), m
    );
    band.scale.set(1, 1, 0.8);
    band.position.y = -0.12;
    g.add(band);
    bx(g, m, 0.025, 0.24, 0.02, -0.11, -0.25, 0.26, { z: 0.5 });
    bx(g, m, 0.025, 0.24, 0.02, 0.11, -0.25, 0.26, { z: -0.5 });
    star(g, m, 0, -0.38, 0.27);
  },
  // hip ring with three dangling charms
  acc_belly_chain(g, m) {
    ring(g, m, 0.37, 0.04, 10, 0);
    bx(g, m, 0.05, 0.09, 0.03, 0.28, -0.07, 0.2);
    bx(g, m, 0.05, 0.09, 0.03, -0.3, -0.07, 0);
    star(g, m, 0, -0.09, 0.36);
  },
  // beaded cuffs just above each hand
  acc_friendship_bracelet(g, m) {
    for (const side of [-1, 1]) {
      const wrist = new THREE.Mesh(
        new THREE.CylinderGeometry(0.17, 0.17, 0.06, 6, 1, true).toNonIndexed(), m
      );
      wrist.position.set(side * 0.48, 0.05, 0.03);
      wrist.rotation.z = side * -0.2;
      g.add(wrist);
      const cx = side * 0.48;
      bx(g, m, 0.05, 0.05, 0.05, cx - side * 0.09, 0.05, 0.16);
      bx(g, m, 0.05, 0.05, 0.05, cx, 0.06, 0.2);
      bx(g, m, 0.05, 0.05, 0.05, cx + side * 0.09, 0.05, 0.16);
    }
  },
  // baguette tube tucked under the right arm + crossbody strap
  acc_baguette_bag(g, m) {
    const bag = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.36, 8, 1, false).toNonIndexed(), m
    );
    bag.position.set(0.34, -0.24, 0.28);
    bag.rotation.z = -0.25;
    g.add(bag);
    bx(g, m, 0.14, 0.05, 0.22, 0.39, -0.05, 0.28);
    bx(g, m, 0.04, 0.82, 0.04, 0.03, -0.06, 0.33, { z: -0.94 });
  },
  // box body + flap + strap over the shoulder
  acc_shoulder_bag(g, m) {
    bx(g, m, 0.3, 0.24, 0.14, 0.38, -0.34, 0.26);
    bx(g, m, 0.32, 0.1, 0.15, 0.38, -0.2, 0.26);
    bx(g, m, 0.05, 0.05, 0.05, 0.38, -0.2, 0.34);
    bx(g, m, 0.035, 0.82, 0.045, 0.0, 0.02, 0.21, { z: 1.05 });
  },
};

const ALL = { ...HEAD_BUILDER, ...HEAD2_BUILDER, ...BODY_BUILDER };

export const ACC_IDS = Object.keys(ALL);

export function createAccessory(id, colorHex) {
  const group = new THREE.Group();
  const mat = makePSXMaterial(colorHex, { gradient: 0.12 });
  let secMat = null;
  if (ALL[id]) {
    // darker variant of the main colour for lenses / inner ears
    secMat = makePSXMaterial(colorHex, { gradient: 0.08 });
    secMat.uniforms.color.value.multiplyScalar(0.45);
    ALL[id](group, mat, secMat);
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
