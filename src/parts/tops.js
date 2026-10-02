import * as THREE from "three";
import { makePSXMaterial } from "../psxRenderer.js";
import { taperBox } from "../character.js";
import { PatternTexture, makeDecal } from "../patterns.js";

// Tops (M4 base set) + M6 style-pack tops + outers. All geometry is a slightly
// enlarged tapered shell over the torso plus sleeves as tapered boxes that
// follow the A-pose arms. Catalog flags: cropped -> shell stops above the
// waist exposing skin. Torso bounds (character.js): y 0.58..1.18, w 0.56->0.66,
// d 0.32; group origin = torso centre (world y 0.88).
// Patterned items get a 32x32 procedural map; decal items (crest / jersey
// number) get a second transparent plane on the chest.

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

// square chest decal (transparent 32x32 canvas on a thin plate)
function chestDecal(g, kind, w = 0.2, h = 0.2, x = 0, y = 0.06, z = 0.19) {
  const tex = makeDecal(kind);
  const mat = makePSXMaterial("#ffffff", { map: tex, gradient: 0.1 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.012).toNonIndexed(), mat);
  m.position.set(x, y, z);
  g.add(m);
  return { tex, mat };
}

// ---- M4 base tops ---------------------------------------------------------
const TOP_BUILDER = {
  top_tee(g, m, _s, flags) {
    const shell = shellGeo(1.06, flags?.cropped ? 0.82 : 1);
    g.add(new THREE.Mesh(shell, m));
    addSleeves(g, m, 0.5, 1.1);
  },
  top_longsleeve(g, m, _s, flags) {
    const shell = shellGeo(1.06, flags?.cropped ? 0.82 : 1);
    g.add(new THREE.Mesh(shell, m));
    addSleeves(g, m, 1.0, 1.1);
  },
  top_sweater(g, m, _s, flags) {
    const shell = shellGeo(1.08, flags?.cropped ? 0.82 : 1.02);
    g.add(new THREE.Mesh(shell, m));
    addSleeves(g, m, 0.9, 1.16);
    g.add(neckTrim(m));
  },
};

// ---- M6 tops --------------------------------------------------------------
const TOP6 = {
  top_baby_tee(g, m, s, f) {
    const shell = shellGeo(1.05, f.cropped ? 0.62 : 1);
    g.add(new THREE.Mesh(shell, m));
    addSleeves(g, m, 0.32, 1.08); // little cap sleeves
  },
  top_knit_vest(g, m, s, f) {
    const shell = shellGeo(1.07, f.cropped ? 0.7 : 1);
    g.add(new THREE.Mesh(shell, m));
    // V-neck placket + bottom hem band in the secondary colour
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.1, 0.05).toNonIndexed(), s
    );
    trim.position.set(0, 0.26, 0.17);
    trim.rotation.z = 0;
    g.add(trim);
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.06, 0.38).toNonIndexed(), s
    );
    band.position.set(0, -0.26, 0);
    g.add(band);
  },
  top_polo(g, m, s) {
    g.add(new THREE.Mesh(shellGeo(1.06), m));
    addSleeves(g, m, 0.5, 1.1);
    g.add(neckTrim(s));
    // button placket on the chest
    const placket = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.16, 0.04).toNonIndexed(), s
    );
    placket.position.set(0, 0.2, 0.18);
    g.add(placket);
  },
  top_offshoulder(g, m, s, f) {
    const shell = shellGeo(1.06, f.cropped ? 0.66 : 1);
    g.add(new THREE.Mesh(shell, m));
    // wide straight neckline band across the shoulders, arms bare
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.66, 0.07, 0.36).toNonIndexed(), s
    );
    band.position.set(0, 0.3, 0);
    g.add(band);
  },
  top_jersey_crop(g, m, s, f) {
    const shell = shellGeo(1.05, f.cropped ? 0.62 : 1);
    g.add(new THREE.Mesh(shell, m));
    addSleeves(g, m, 0.42, 1.1); // contrast sleeves in secondary
    chestDecal(g, "12", 0.2, 0.24, 0, 0.08, 0.18);
  },
  top_denim_shirt(g, m) {
    g.add(new THREE.Mesh(shellGeo(1.06), m));
    addSleeves(g, m, 1.0, 1.1);
    // chest flap pockets + button placket
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(
        new THREE.BoxGeometry(0.13, 0.11, 0.03).toNonIndexed(), m
      );
      p.position.set(side * 0.14, 0.08, 0.185);
      g.add(p);
    }
    const placket = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.5, 0.03).toNonIndexed(), m
    );
    placket.position.set(0, 0, 0.19);
    g.add(placket);
  },
};

// ---- outers (slot "outer", bigger envelope 1.14) ---------------------------
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

const OUTER6 = {
  top_jacket(g, m, _s, f) {
    const shell = shellGeo(1.14, f.cropped ? 0.82 : 1, true);
    g.add(new THREE.Mesh(shell, m));
    addSleeves(g, m, 1.0, 1.26);
    collarBox(g, m);
    frontLapels(g, m);
  },
  outer_blazer(g, m, s, f) {
    const shell = shellGeo(1.14, f.cropped ? 0.82 : 1, true);
    g.add(new THREE.Mesh(shell, m));
    addSleeves(g, m, 1.0, 1.26);
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
  outer_denim_jacket(g, m) {
    const shell = shellGeo(1.14, 1, true);
    g.add(new THREE.Mesh(shell, m));
    addSleeves(g, m, 1.0, 1.26);
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
  outer_bomber(g, m, s, f) {
    const shell = shellGeo(1.14, f.cropped ? 0.82 : 1, true);
    g.add(new THREE.Mesh(shell, m));
    addSleeves(g, m, 1.0, 1.26);
    collarBox(g, m, 0.6);
    // ribbed hem band + bomber zip band
    const hem = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.09, 0.4).toNonIndexed(), s
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

const BUILDERS = { ...TOP_BUILDER, ...TOP6, ...OUTER6 };

// pattern -> whole-garment map material; else plain main colour
const PATTERNED = new Set(["denim", "plaid", "stripes", "metallic", "star"]);

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

export function createTop(id, colors, flags = {}, patternName = null) {
  const group = new THREE.Group();
  const main = colors.main ?? "#ffffff";
  const sec = colors.secondary ?? null;
  let mat, secMat = null, pattern = null;
  if (patternName && PATTERNED.has(patternName)) {
    pattern = new PatternTexture();
    pattern.set(patternName, main, sec ?? main);
    mat = makePSXMaterial("#ffffff", { map: pattern.texture, gradient: 0.18 });
  } else {
    mat = makePSXMaterial(main, { gradient: 0.18 });
  }
  if (sec) {
    secMat = makePSXMaterial(sec, { gradient: 0.18 });
  } else {
    // single colour slot: derived darker shade for trims/collars/zips
    secMat = makePSXMaterial(main, { gradient: 0.18 });
    secMat.uniforms.color.value.multiplyScalar(0.45);
  }
  if (BUILDERS[id]) BUILDERS[id](group, mat, secMat, flags);
  count(group, id);
  return { group, mat, secMat, pattern };
}
