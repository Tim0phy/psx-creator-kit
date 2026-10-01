import * as THREE from "three";
import { makePSXMaterial } from "../psxRenderer.js";
import { taperBox } from "../character.js";

// M4 tops + outer (base set). All geometry is a slightly enlarged tapered
// shell over the torso plus sleeves as tapered boxes that follow the A-pose
// arms. Catalog flags: cropped -> shell stops above the waist exposing skin.
// Torso bounds (character.js): y 0.58..1.18, w 0.56->0.66, d 0.32.

// shell around the torso, flared like the body; hScale lets a cropped top
// end higher. open front for outerwear keeps the top visible underneath.
function shellGeo(enl, hScale = 1, open = false) {
  const w = 0.56 * enl, botW = 0.66 * enl, d = 0.32 * enl;
  const h = 0.6 * hScale;
  const g = taperBox(w, h, d, w, botW).toNonIndexed();
  if (hScale < 1) {
    // move the shortened shell up so it hangs from the shoulders down
    g.translate(0, (0.6 - h) / 2, 0);
  }
  if (!open) return g;
  // open front: drop the front plate (normals facing +z) so the top shows
  g.computeVertexNormals();
  const p = g.attributes.position;
  const n = g.attributes.normal;
  const keep = [];
  for (let t = 0; t < p.count; t += 3) {
    if (n.getZ(t) > 0.5) continue;
    for (let k = 0; k < 3; k++) keep.push(p.getX(t+k), p.getY(t+k), p.getZ(t+k));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.Float32BufferAttribute(keep, 3));
  out.computeVertexNormals();
  return out;
}

// sleeve: tapered box around the arm. len 1 = upper arm to elbow,
// len 1.75 = full sleeve to the wrist. Arms rotate z +/-0.2 rad about their
// group pivot at (±0.36, 1.18).
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

function addSleeves(root, mat, len, enl) {
  for (const side of [-1, 1]) {
    const s = sleeveMesh(len, mat, enl);
    s.position.set(side * 0.36, 0.3, 0);
    s.rotation.z = side * 0.2;
    root.add(s);
  }
}

function neckTrim(mat) {
  const g = new THREE.BoxGeometry(0.2, 0.06, 0.18).toNonIndexed();
  const m = new THREE.Mesh(g, mat);
  m.position.set(0, 0.32, 0.03);
  return m;
}

const TOP_BUILDER = {
  top_tee(g, m, flags) {
    const shell = shellGeo(1.06, flags.cropped ? 0.82 : 1);
    g.add(new THREE.Mesh(shell, m));
    addSleeves(g, m, 0.5, 1.1);
  },
  top_longsleeve(g, m, flags) {
    const shell = shellGeo(1.06, flags.cropped ? 0.82 : 1);
    g.add(new THREE.Mesh(shell, m));
    addSleeves(g, m, 1.0, 1.1);
  },
  top_sweater(g, m, flags) {
    const shell = shellGeo(1.08, flags.cropped ? 0.82 : 1.02);
    g.add(new THREE.Mesh(shell, m));
    addSleeves(g, m, 0.9, 1.16);
    g.add(neckTrim(m));
  },
};

// outerwear (slot "outer"): must sit over the top -> bigger envelope (1.14)
// to keep a clear gap and stop z-fighting with tights tops (1.06-1.08).
const OUTER_BUILDER = {
  top_jacket(g, m, flags) {
    const shell = shellGeo(1.14, flags.cropped ? 0.82 : 1, true);
    g.add(new THREE.Mesh(shell, m));
    addSleeves(g, m, 1.0, 1.26);
    const collar = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.08, 0.4).toNonIndexed(), m
    );
    collar.position.y = 0.3;
    g.add(collar);
    // front lapels: two vertical panels closing over the top underneath
    for (const side of [-1, 1]) {
      const lapel = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.52, 0.06).toNonIndexed(), m
      );
      lapel.position.set(side * 0.16, -0.02, 0.2);
      lapel.rotation.z = side * 0.06;
      g.add(lapel);
    }
  },
};

function count(g, id, max = 150) {
  let tris = 0;
  g.traverse((o) => {
    if (o.isMesh) {
      o.geometry.computeBoundingSphere();
      tris += o.geometry.attributes.position.count / 3;
    }
  });
  console.log(`[psxcc] ${id}: ${tris} tris (max ${max})`);
  return tris;
}

const BUILDERS = { ...TOP_BUILDER, ...OUTER_BUILDER };

export function createTop(id, colorHex, flags = {}) {
  const group = new THREE.Group();
  const mat = makePSXMaterial(colorHex, { gradient: 0.18 });
  if (BUILDERS[id]) BUILDERS[id](group, mat, flags);
  count(group, id);
  return { group, mat };
}
