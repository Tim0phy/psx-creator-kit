import * as THREE from "three";
import { makePSXMaterial } from "../psxRenderer.js";
import { bodyFit } from "../character.js";
import { PatternTexture } from "../patterns.js";
import { chestDecal, neckTrim, shellGeo, addSleeves } from "./fit.js";
import { OUTER_BUILDER } from "./outer.js";

// Tops (M4 base set) + M6 style-pack tops, with outers in ./outer.js. All
// geometry is a slightly enlarged tapered shell over the torso plus sleeves
// as tapered boxes that follow the A-pose arms. Dimensions derive from the
// body profile (M8 selector): see ./fit.js. Catalog flags: cropped -> shell
// stops above the waist exposing skin. Torso bounds (character.js):
// y 0.58..1.18, widths hips->shoulders per profile; group origin = torso
// centre (world y 0.88). Patterned items get a 32x32 procedural map; decal
// items (crest / jersey number) get a second transparent plane on the chest.

// ---- M4 base tops ---------------------------------------------------------
const TOP_BUILDER = {
  top_tee(g, m, _s, flags, fit) {
    const shell = shellGeo(fit.profile, 1.06, flags?.cropped ? 0.82 : 1);
    g.add(new THREE.Mesh(shell, m));
    addSleeves(g, m, 0.5, 1.1, fit.profile);
  },
  top_longsleeve(g, m, _s, flags, fit) {
    const shell = shellGeo(fit.profile, 1.06, flags?.cropped ? 0.82 : 1);
    g.add(new THREE.Mesh(shell, m));
    addSleeves(g, m, 1.0, 1.1, fit.profile);
  },
  top_sweater(g, m, _s, flags, fit) {
    const shell = shellGeo(fit.profile, 1.08, flags?.cropped ? 0.82 : 1.02);
    g.add(new THREE.Mesh(shell, m));
    addSleeves(g, m, 0.9, 1.16, fit.profile);
    g.add(neckTrim(m));
  },
};

// ---- M6 tops --------------------------------------------------------------
const TOP6 = {
  top_baby_tee(g, m, s, f, fit) {
    const shell = shellGeo(fit.profile, 1.05, f.cropped ? 0.62 : 1);
    g.add(new THREE.Mesh(shell, m));
    addSleeves(g, m, 0.32, 1.08, fit.profile); // little cap sleeves
  },
  top_knit_vest(g, m, s, f, fit) {
    const shell = shellGeo(fit.profile, 1.07, f.cropped ? 0.7 : 1);
    g.add(new THREE.Mesh(shell, m));
    // V-neck placket + bottom hem band in the secondary colour
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.1, 0.05).toNonIndexed(), s
    );
    trim.position.set(0, 0.26, 0.17);
    trim.rotation.z = 0;
    g.add(trim);
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.62 * fit.hw, 0.06, 0.38).toNonIndexed(), s
    );
    band.position.set(0, -0.26, 0);
    g.add(band);
  },
  top_polo(g, m, s, _f, fit) {
    g.add(new THREE.Mesh(shellGeo(fit.profile, 1.06), m));
    addSleeves(g, m, 0.5, 1.1, fit.profile);
    g.add(neckTrim(s));
    // button placket on the chest
    const placket = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.16, 0.04).toNonIndexed(), s
    );
    placket.position.set(0, 0.2, 0.18);
    g.add(placket);
  },
  top_offshoulder(g, m, s, f, fit) {
    const shell = shellGeo(fit.profile, 1.06, f.cropped ? 0.66 : 1);
    g.add(new THREE.Mesh(shell, m));
    // wide straight neckline band across the shoulders, arms bare
    const band = new THREE.Mesh(
      new THREE.BoxGeometry(0.66 * fit.sw, 0.07, 0.36).toNonIndexed(), s
    );
    band.position.set(0, 0.3, 0);
    g.add(band);
  },
  top_jersey_crop(g, m, s, f, fit) {
    const shell = shellGeo(fit.profile, 1.05, f.cropped ? 0.62 : 1);
    g.add(new THREE.Mesh(shell, m));
    addSleeves(g, m, 0.42, 1.1, fit.profile); // contrast sleeves in secondary
    chestDecal(g, "12", 0.2, 0.24, 0, 0.08, 0.18);
  },
  top_denim_shirt(g, m, _s, _f, fit) {
    g.add(new THREE.Mesh(shellGeo(fit.profile, 1.06), m));
    addSleeves(g, m, 1.0, 1.1, fit.profile);
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

const BUILDERS = { ...TOP_BUILDER, ...TOP6, ...OUTER_BUILDER };

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

export function createTop(id, colors, flags = {}, patternName = null, bodyType = "female") {
  const fit = bodyFit(bodyType);
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
  if (BUILDERS[id]) BUILDERS[id](group, mat, secMat, flags, fit);
  count(group, id);
  return { group, mat, secMat, pattern };
}
