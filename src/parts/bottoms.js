import * as THREE from "three";
import { makePSXMaterial } from "../psxRenderer.js";
import { bodyFit } from "../character.js";
import { PatternTexture } from "../patterns.js";

// M4 bottoms (base set) + M6 style packs: tapered pants, shorts, faceted
// (low-poly 8-sided) skirts, pleats, denim/plaid/metallic maps. Dimensions
// derive from the body profile (M8 selector) via bodyFit(). Catalog flags:
// lowRise -> waistline drops to the hip so skin shows between top and
// bottom; wide -> wider at ankle (reverse taper).
// Torso bottom y=0.58, legs y 0.06..0.62 at x ±legX (half-w ~0.17->0.135),
// feet top y=0.18.

const WAIST = 0.74;   // normal waistband top (long pants)
const HIGH = 1.02;    // shorts/skirt waistband top (navel height)
const HIP = 0.6;      // low-rise waistband top (on the hips)

// hips/pelvis block from y=0.5 up to waistY. Width from the profile
// (female hem 0.56 half-w 0.28, waist-side 0.48): narrower than any top
// shell so the two never intersect and z-fight. depth defaults inside the
// tee shell (half 0.15); shorts use 0.36 so the front face sits in front
// of the tee hem and the waist reads continuously.
function hipsMesh(mat, p, waistY, depth = 0.3) {
  const h = waistY - 0.5;
  const g = new THREE.BoxGeometry(p.hipsW, h, depth).toNonIndexed();
  const q = g.attributes.position;
  for (let i = 0; i < q.count; i++) {
    const t = (q.getY(i) + h / 2) / h; // 0 bottom -> 1 top
    q.setX(i, q.getX(i) * ((p.hipsTopW + (p.hipsW - p.hipsTopW) * (1 - t)) / p.hipsW));
  }
  g.translate(0, 0.5 + h / 2, 0);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

// two pant/tube legs: tapered boxes, narrower towards the ankle
// (taper = fraction narrower at the bottom end; negative -> wider, "wide").
// Tube x centring follows the profile leg pivot (±legX, identical bodies).
function tubeMeshes(group, mat, opt, p) {
  const h = opt.top - opt.bottom;
  for (const side of [-1, 1]) {
    const g = new THREE.BoxGeometry(opt.r, h, opt.r).toNonIndexed();
    const q = g.attributes.position;
    for (let i = 0; i < q.count; i++) {
      const t = (q.getY(i) + h / 2) / h; // 0 at bottom, 1 at top
      const w = 1 - opt.taper * (1 - t); // top=1, bottom=1-taper
      const x =
        q.getX(i) * w + side * (p.legX ?? 0.19) * (1 + (opt.splay ?? 0) * (1 - t));
      q.setXYZ(i, x, q.getY(i), q.getZ(i) * w);
    }
    g.translate(0, opt.bottom + h / 2, 0);
    g.computeVertexNormals();
    group.add(new THREE.Mesh(g, mat));
  }
}

// faceted skirt: open 8-sided flare cone (8 quads = flat facets), not smooth
function skirtMesh(mat, wr, rTop, rBottom, topY, botY) {
  const g = new THREE.CylinderGeometry(
    rTop * wr, rBottom * wr, topY - botY, 8, 1, true
  );
  g.translate(0, (topY + botY) / 2, 0);
  const a = g.toNonIndexed();
  a.computeVertexNormals();
  return new THREE.Mesh(a, mat);
}

// waistband + skirt mouths r 0.32 * wr (half-w ~0.296) stay inside the tee
// shell (0.297) -> no clipping with tops; skirts flare wider below the hem.
function waistbandMesh(mat, p, bandY) {
  const g = new THREE.CylinderGeometry(p.skirtR, p.skirtR, 0.07, 8, 1, true)
    .toNonIndexed();
  g.translate(0, bandY, 0);
  g.computeVertexNormals();
  return new THREE.Mesh(g, mat);
}

function box(w, h, d, x, y, z, mat) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d).toNonIndexed(), mat
  );
  mesh.position.set(x, y, z);
  return mesh;
}

// ---- M6 style-pack bottoms -------------------------------------------------
const PATTERNED_BOTTOMS = new Set(["denim", "plaid", "stripes", "metallic", "star"]);

// low-rise jeans: same fit as long pants but the waistline sits on the hips
// so skin shows between the waistband and any cropped top
function bot_lowrise_jeans(g, m, f, fit) {
  const waist = f.lowRise ? HIP : WAIST;
  g.add(hipsMesh(m, fit.profile, waist));
  tubeMeshes(g, m, { r: 0.42, top: 0.64, bottom: 0.3, taper: 0.03, splay: 0.03 }, fit.profile);
}

// wide cargo: reversed taper (wider at the ankle) + front thigh pockets
function bot_cargo_wide(g, m, f, fit) {
  const waist = f.lowRise ? HIP : WAIST;
  g.add(hipsMesh(m, fit.profile, waist));
  tubeMeshes(g, m, { r: 0.42, top: 0.64, bottom: 0.28, taper: -0.18, splay: 0.02 }, fit.profile);
  for (const side of [-1, 1]) {
    g.add(box(0.16, 0.2, 0.2, side * 0.36, 0.42, 0.16, m)); // front thigh pocket
    g.add(box(0.18, 0.05, 0.22, side * 0.36, 0.53, 0.16, m)); // pocket flap
  }
}

// pleated skirt: N flat vertical panels around an 8-gon, alternating hem
// radius so it reads pleated rather than a smooth cone. UVs span each panel
// so the 32x32 plaid map shows once per pleat face.
function pleatSkirt(g, mat, pleats, rTop, rBot, topY, botY) {
  const verts = [], uvs = [];
  for (let i = 0; i < pleats; i++) {
    const a0 = (i / pleats) * Math.PI * 2;
    const a1 = ((i + 1) / pleats) * Math.PI * 2;
    const rb = i % 2 ? rBot : rBot * 0.9; // alternating hem zig-zag
    const p0 = [Math.sin(a0) * rTop, topY, Math.cos(a0) * rTop];
    const p1 = [Math.sin(a1) * rTop, topY, Math.cos(a1) * rTop];
    const q0 = [Math.sin(a0) * rb, botY, Math.cos(a0) * rb];
    const q1 = [Math.sin(a1) * rb, botY, Math.cos(a1) * rb];
    verts.push(...p0, ...q0, ...p1, ...p1, ...q0, ...q1);
    uvs.push(0, 1, 0, 0, 1, 1, 1, 1, 0, 0, 1, 0);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, mat));
}

function bot_plaid_pleated(g, m, f, fit) {
  const waist = f.lowRise ? HIP : WAIST;
  g.add(waistbandMesh(m, fit.profile, waist + 0.3));
  pleatSkirt(g, m, 8, 0.33 * fit.wr, 0.5 * fit.wr, waist + 0.28, waist - 0.24);
}

function bot_tennis_skirt(g, m, f, fit) {
  const waist = f.lowRise ? HIP : WAIST;
  g.add(waistbandMesh(m, fit.profile, waist + 0.3));
  pleatSkirt(g, m, 6, 0.32 * fit.wr, 0.46 * fit.wr, waist + 0.3, waist - 0.22);
}

function bot_lowrise_mini(g, m, f, fit) {
  const waist = f.lowRise ? HIP : WAIST;
  // rectangular waistband flush with the skirt box (a round cylinder band
  // would float around the rectangle front/sides like a hoop); waist-anchored
  // scale so it hugs the slim female waist / straight male waist
  const bandW = 0.68 * fit.ww;
  const band = new THREE.BoxGeometry(bandW, 0.09, 0.4).toNonIndexed();
  band.translate(0, waist + 0.2, 0);
  band.computeVertexNormals();
  g.add(new THREE.Mesh(band, m));
  // rectangular A-line skirt box (matches the boxy hips silhouette — no
  // hula-hoop round profile from the side like the old 8-gon cylinder)
  const topY = waist + 0.2;
  const h = 0.38; // hem at waist - 0.18
  const bg = new THREE.BoxGeometry(0.66 * fit.ww, h, 0.36).toNonIndexed();
  const q = bg.attributes.position;
  for (let i = 0; i < q.count; i++) {
    const t = (q.getY(i) + h / 2) / h; // 0 bottom -> 1 top
    const w = 1 + 0.14 * (1 - t); // slight flare to the hem
    q.setXYZ(i, q.getX(i) * w, q.getY(i), q.getZ(i) * w);
  }
  bg.translate(0, topY - h / 2, 0);
  bg.computeVertexNormals();
  g.add(new THREE.Mesh(bg, m));
}

function bot_metallic_pants(g, m, f, fit) {
  const waist = f.lowRise ? HIP : WAIST;
  g.add(hipsMesh(m, fit.profile, waist));
  g.add(waistbandMesh(m, fit.profile, waist + 0.32)); // high-waist band
  tubeMeshes(g, m, { r: 0.42, top: 0.66, bottom: 0.3, taper: 0.04, splay: 0.03 }, fit.profile);
}

const BOTTOM_BUILDER = {
  bot_long_pants(g, m, f, fit) {
    const waist = f.lowRise ? HIP : WAIST;
    g.add(hipsMesh(m, fit.profile, waist));
    // hem 0.3 tucks into the shoe cuff (cuff lip 0.22..0.32 wraps the hem);
    // taper 0.05 keeps the two tubes overlapping at the centre (no slit)
    tubeMeshes(g, m, { r: 0.42, top: 0.64, bottom: 0.3, taper: 0.05, splay: 0.03 }, fit.profile);
  },
  bot_shorts(g, m, f, fit) {
    // dungaree/overall shorts: bib + shoulder straps over the tee
    const waist = f.lowRise ? HIP : HIGH;
    g.add(hipsMesh(m, fit.profile, waist, 0.36));
    g.add(box(0.58, 0.08, 0.38, 0, waist + 0.03, 0, m)); // belt band
    g.add(box(0.26, 0.34, 0.05, 0, waist + 0.03, 0.19, m)); // front bib
    for (const side of [-1, 1]) {
      g.add(box(0.08, 0.08, 0.05, side * 0.11, waist + 0.13, 0.19, m));
      g.add(box(0.08, 0.05, 0.42, side * 0.11, 1.18, 0, m)); // shoulder bridge
      g.add(box(0.08, 0.08, 0.05, side * 0.11, waist + 0.13, -0.19, m));
    }
    // straight tubes: r 0.4 stays 0.02 clear of the leg (z half 0.17), and
    // the tubes overlap at the centre (no slit); hem 0.43 reaches down to
    // the shoe cuff (top 0.25)
    tubeMeshes(g, m, { r: 0.4, top: 0.66, bottom: 0.43, taper: 0, splay: 0.03 }, fit.profile);
  },
  bot_short_skirt(g, m, f, fit) {
    const waist = f.lowRise ? HIP : WAIST;
    g.add(waistbandMesh(m, fit.profile, waist + 0.3));
    g.add(skirtMesh(m, fit.wr, 0.32, 0.5, waist + 0.3, waist - 0.28));
  },
  bot_long_skirt(g, m, f, fit) {
    const waist = f.lowRise ? HIP : WAIST;
    g.add(waistbandMesh(m, fit.profile, waist + 0.3));
    g.add(skirtMesh(m, fit.wr, 0.34, 0.62, waist + 0.28, 0.14));
  },
  bot_lowrise_jeans,
  bot_cargo_wide,
  bot_plaid_pleated,
  bot_tennis_skirt,
  bot_lowrise_mini,
  bot_metallic_pants,
};

export function createBottom(id, colors, flags = {}, patternName = null, bodyType = "female") {
  const fit = bodyFit(bodyType);
  const group = new THREE.Group();
  const main = colors.main ?? "#ffffff";
  let mat;
  let builtPattern = null;
  if (patternName && PATTERNED_BOTTOMS.has(patternName)) {
    builtPattern = new PatternTexture();
    builtPattern.set(patternName, main, colors.secondary ?? main);
    mat = makePSXMaterial("#ffffff", {
      map: builtPattern.texture, side: THREE.DoubleSide, gradient: 0.18,
    });
  } else {
    mat = makePSXMaterial(main, {
      side: THREE.DoubleSide, gradient: 0.18,
    });
  }
  if (BOTTOM_BUILDER[id]) BOTTOM_BUILDER[id](group, mat, flags, fit);
  let tris = 0;
  group.traverse((o) => {
    if (o.isMesh) {
      o.geometry.computeBoundingSphere();
      tris += o.geometry.attributes.position.count / 3;
    }
  });
  console.log(`[psxcc] ${id}: ${tris} tris (max 150)`);
  return { group, mat, pattern: builtPattern };
}
