import * as THREE from "three";
import { bakeClone, disposeClone } from "./exporter.js";
import { combineFaceCanvas } from "./exportFace.js";
import { printOBJFilename } from "./exportZip.js";
import { analyseMeshes } from "./meshCheck.js";
import { getPoseEngine } from "./pose.js";
import {
  weldSoup, shellSplit, shellFacts, solidifyShell, rewindShell,
  thickenShell, subdivideFaceTri,
} from "./printSolidify.js";

// M9 print OBJ ("OBJ for 3D printing"):
//   bakeClone(raw + neutral yaw) -> bake world matrices -> scale to
//   MILLIMETRES so the character stands exactly heightMm tall -> manufacture
//   per shell:
//     open sheet     -> rim solidify (thicknessMm; outer surface untouched)
//     closed + thin  -> thinnest-axis scale to thicknessMm
//     closed solid   -> kept (the head too; only its FACE group lattice-
//                       subdivides so the face canvas bakes into vertex colour)
//   -> origin at the base centre, feet exactly on Y=0, optional round base
//   disc + optional foot bridge -> analyseMeshes report -> ONE "v x y z
//   [r g b]" object in millimetres. Colour = canvas/pattern sample x baked
//   ramp (raw screen values); "single colour" writes no colour data at all.
//   Nothing uploads.

const TRI_BUDGET = 20000; // subdivision budget (spec)
const BASE_T = 3;         // base disc thickness (mm)
const BRIDGE_H = 3;       // foot bridge height (mm)
const GROUND = [0.91, 0.847, 0.627]; // the app's ground amber (#e8d8a0)

const fN = (n) => {
  const s = Number((Number(n) || 0).toFixed(4));
  return Object.is(s, -0) ? "0" : String(s);
};

// ------------------------------------------------------------------ pipeline

export async function exportPrintOBJ(
  { character, face },
  {
    name = "", heightMm = 80, thicknessMm = 1.2,
    base = true, connectFeet = true, coloured = true,
  } = {}
) {
  const skinHex = character.mats.skin.uniforms.color.value.getHexString();
  const faceCanvas = face?.eyesBig
    ? combineFaceCanvas(skinHex, face.eyesBig, face.mouthBig)
    : null;
  const clone = bakeClone(
    { character, face: faceCanvas ? { canvas: faceCanvas } : null },
    { colourMode: "raw", neutralYaw: true }
  );
  if (!clone) throw new Error("bake failed");
  clone.updateMatrixWorld(true); // fresh matrices AFTER the neutral-yaw reset
  try {
    const samplers = new Map(); // canvas -> nearest sampler
    const getSamp = (canvas) => {
      if (!coloured || !canvas) return null;
      if (!samplers.has(canvas)) samplers.set(canvas, makeSampler(canvas));
      return samplers.get(canvas);
    };

    const pieces = [];
    clone.traverse((o) => { if (o.isMesh) pieces.push(buildPiece(o)); });
    const b = bounds(pieces.map((p) => p.P));
    if (b.h < 1e-6) throw new Error("empty print");
    const mid = [b.cx, b.minY, b.cz];
    const s = heightMm / b.h;
    for (const p of pieces) bakeToMM(p.P, mid, s);

    // adaptive head-face lattice k out of the shared triangle budget
    // (uniform k on ALL head tris keeps the surface T-junction-free)
    const head = pieces.find((p) => p.isHead);
    let k = 1;
    if (coloured && head?.faceTris) {
      const baseT = pieces.reduce((t, p) => t + p.P.length / 9, 0);
      const headTris = head.P.length / 9;
      k = Math.max(1, Math.min(16,
        Math.floor(Math.sqrt((TRI_BUDGET - baseT + headTris) / headTris))));
    }

    const M = { pos: [], col: coloured ? [] : null };
    const notes = { rewound: 0, solidified: 0, thickened: 0 };
    let minWall = Infinity;
    for (const p of pieces) {
      if (p.isHead) {
        writeHead(p, k, getSamp(p.canvas), M);
        minWall = Math.min(minWall, minExtent(p.P)); // head stays a solid slab
      } else {
        const samp = p.hasMap ? getSamp(p.canvas) : null;
        if (samp) bakePatternColours(p, samp);
        minWall = Math.min(minWall, manufacture(p, M, thicknessMm, notes));
      }
    }
    // ground furniture: measured off the manufactured body...
    const body = bounds([new Float32Array(M.pos)]);
    if (!Number.isFinite(body.h))
      throw new Error("manufacture produced NaN geometry");
    if (connectFeet) appendBridge(M, body, coloured);
    if (base) appendDisc(M, body, coloured);
    // ...and the final report runs AFTER the disc wraps everything
    const report = analyseMeshes([{ positions: new Float32Array(M.pos) }]);
    const text = assembleOBJ(M, report, { heightMm, thicknessMm, notes, coloured });
    return {
      ok: true,
      blob: new Blob([text], { type: "text/plain" }),
      filename: printOBJFilename(name, heightMm),
      stats: { tris: report.triCount, verts: report.verts },
      minWallMm: Number.isFinite(minWall) ? minWall : thicknessMm,
      report,
      warnings: poseWarnings(),
    };
  } finally {
    disposeClone(clone);
  }
}

// --------------------------------------------------------------- manufacture

// per-piece per-shell factory; returns the piece's lowest wall estimate (mm)
function manufacture(p, M, thicknessMm, notes) {
  if (!p.P.length) return Infinity;
  let minWall = Infinity;
  const welded = weldSoup(p.P, M.col ? p.C : null);
  for (const comp of shellSplit(welded.tris)) {
    const st = new Uint32Array(comp.length * 3); // welded tri list
    for (let i = 0; i < comp.length; i++)
      for (let kk = 0; kk < 3; kk++)
        st[i * 3 + kk] = welded.tris[comp[i] * 3 + kk];
    let facts = shellFacts(welded.pos, st);
    if (facts.volume < 0) { st.set(rewindShell(st)); notes.rewound++; }
    facts = shellFacts(welded.pos, st);
    const minEx = Math.min(facts.extents.x, facts.extents.y, facts.extents.z);
    if (facts.boundary.length) {
      const m = solidifyShell(welded.pos, welded.col, st, thicknessMm, facts);
      append(M, m.pos, m.col); notes.solidified++;
      minWall = Math.min(minWall, thicknessMm);
    } else if (minEx < thicknessMm * 0.8) {
      const m = thickenShell(welded.pos, welded.col, st, thicknessMm);
      append(M, m.pos, m.col); notes.thickened++;
      minWall = Math.min(minWall, thicknessMm);
    } else {
      appendRaw(M, welded, st);
      minWall = Math.min(minWall, minEx);
    }
  }
  return minWall;
}

// head: uniform lattice subdivision of ALL head tris (T-junction-free); the
// FACE region additionally samples the canvas at every lattice node
function writeHead(p, k, sample, M) {
  const tris = p.P.length / 9;
  const fn = Math.min(tris, p.faceTris);
  for (let t = 0; t < tris; t++) {
    if (!sample || k <= 1) {
      for (let c = 0; c < 3; c++) {
        const i = t * 9 + c * 3;
        M.pos.push(p.P[i], p.P[i + 1], p.P[i + 2]);
        if (M.col) M.col.push(p.C[i], p.C[i + 1], p.C[i + 2]);
      }
      continue;
    }
    subdivideFaceTri(
      [p.P[t * 9], p.P[t * 9 + 1], p.P[t * 9 + 2],
        p.P[t * 9 + 3], p.P[t * 9 + 4], p.P[t * 9 + 5],
        p.P[t * 9 + 6], p.P[t * 9 + 7], p.P[t * 9 + 8]],
      [p.C[t * 9], p.C[t * 9 + 1], p.C[t * 9 + 2],
        p.C[t * 9 + 3], p.C[t * 9 + 4], p.C[t * 9 + 5],
        p.C[t * 9 + 6], p.C[t * 9 + 7], p.C[t * 9 + 8]],
      [p.U[t * 6], p.U[t * 6 + 1], p.U[t * 6 + 2],
        p.U[t * 6 + 3], p.U[t * 6 + 4], p.U[t * 6 + 5]],
      k, t < fn ? sample : null, { pos: M.pos, col: M.col }
    );
  }
}

// pattern surfaces: per-corner colour = canvas sample x baked ramp
function bakePatternColours(p, sample) {
  const n = p.P.length / 3;
  for (let i = 0; i < n; i++) {
    const s = sample(p.U?.[i * 2] ?? 0, p.U?.[i * 2 + 1] ?? 0);
    for (let d = 0; d < 3; d++)
      p.C[i * 3 + d] = Math.min(1, p.C[i * 3 + d] * s[d]);
  }
}

// ------------------------------------------------------------ small helpers

function makeSampler(canvas) {
  const W = canvas.width, H = canvas.height;
  const px = canvas.getContext("2d").getImageData(0, 0, W, H).data;
  return (u, v) => {
    let cx = Math.floor(u * W), cy = Math.floor((1 - v) * H);
    cx = Math.min(W - 1, Math.max(0, cx));
    cy = Math.min(H - 1, Math.max(0, cy));
    const i = (cy * W + cx) * 4;
    if (px[i + 3] < 128) return [1, 1, 1]; // transparent texel fallback white
    return [px[i] / 255, px[i + 1] / 255, px[i + 2] / 255];
  };
}

// clone mesh -> flat corner arrays baked into WORLD space (fresh matrices)
function buildPiece(mesh) {
  const geo = mesh.geometry;
  const idx = geo.getIndex();
  const pos = geo.attributes.position;
  const col = geo.attributes.color ?? null;
  const uv = geo.attributes.uv ?? null;
  const count = idx ? idx.count : pos.count;
  const P = new Float32Array(count * 3);
  const C = new Float32Array(count * 3);
  const U = uv ? new Float32Array(count * 2) : null;
  const mw = mesh.matrixWorld; // refreshed AFTER the neutral-yaw reset
  const v = new THREE.Vector3();
  for (let i = 0; i < count; i++) {
    const j = idx ? idx.array[i] : i;
    v.fromBufferAttribute(pos, j).applyMatrix4(mw);
    P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z;
    C[i * 3] = col ? col.getX(j) : 1;
    C[i * 3 + 1] = col ? col.getY(j) : 1;
    C[i * 3 + 2] = col ? col.getZ(j) : 1;
    if (U) { U[i * 2] = uv.getX(j); U[i * 2 + 1] = uv.getY(j); }
  }
  const isHead = mesh.userData?.exportSlot === "head";
  const hasMap = Array.isArray(mesh.material)
    ? !!mesh.material[0].map : !!mesh.material.map;
  const canvas = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material)
    ?.map?.image ?? null;
  const faceTris = isHead && Array.isArray(mesh.material) && geo.groups[0]
    ? geo.groups[0].count / 3 : 0;
  return { P, C, U, isHead, faceTris, hasMap, canvas };
}

// bake-to-mm: p' = (p - [cx, minY, cz]) * s (feet land ON y=0)
function bakeToMM(P, mid, s) {
  for (let i = 0; i < P.length / 3; i++)
    for (let k = 0; k < 3; k++)
      P[i * 3 + k] = (P[i * 3 + k] - mid[k]) * s;
}

// bounds of one or more corner arrays; `ground` = slice within 2.5 mm of
// the lowest vertex (bridge placement)
function bounds(lists) {
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
  for (const P of lists)
    for (let i = 0; i < P.length / 3; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
      if (x < x0) x0 = x; if (x > x1) x1 = x;
      if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (z < z0) z0 = z; if (z > z1) z1 = z;
    }
  const out = {
    x0, y0, z0, x1, y1, z1,
    minY: y0, cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, h: y1 - y0,
  };
  const g = { x0: 1e9, z0: 1e9, x1: -1e9, z1: -1e9, n: 0 };
  for (const P of lists)
    for (let i = 0; i < P.length / 3; i++)
      if (P[i * 3 + 1] < out.minY + 2.5) {
        g.n++;
        g.x0 = Math.min(g.x0, P[i * 3]); g.x1 = Math.max(g.x1, P[i * 3]);
        g.z0 = Math.min(g.z0, P[i * 3 + 2]);
        g.z1 = Math.max(g.z1, P[i * 3 + 2]);
      }
  out.ground = g.n ? g : null;
  return out;
}

function minExtent(P) {
  const b = bounds([P]);
  return Math.min(b.x1 - b.x0, b.y1 - b.y0, b.z1 - b.z0);
}

function append(M, pos, col) {
  const n = pos.length;
  for (let i = 0; i < n; i++) {
    M.pos.push(pos[i]);
    if (M.col && col) M.col.push(col[i]);
  }
}

// raw shell emit (closed solids that need no work): st = welded tri list
function appendRaw(M, welded, st) {
  for (let i = 0; i < st.length; i++) {
    const v = st[i];
    M.pos.push(welded.pos[v * 3], welded.pos[v * 3 + 1], welded.pos[v * 3 + 2]);
    if (M.col && welded.col)
      M.col.push(welded.col[v * 3], welded.col[v * 3 + 1], welded.col[v * 3 + 2]);
  }
}

// ---------------------------------------------------------- ground furniture

function appendBox(M, geo, coloured) {
  const n = geo.attributes.position;
  for (let i = 0; i < n.count; i++) {
    M.pos.push(n.getX(i), n.getY(i), n.getZ(i));
    if (M.col) M.col.push(...GROUND);
  }
  void coloured;
}

// slim bridge under both ground contacts (top overlaps the soles slightly)
function appendBridge(M, body, coloured) {
  const g = body.ground;
  if (!g) return;
  const w = (g.x1 - g.x0) + 6;
  const d = Math.max(8, Math.min(16, g.z1 - g.z0));
  const geo = new THREE.BoxGeometry(w, BRIDGE_H, d).toNonIndexed();
  geo.translate((g.x0 + g.x1) / 2, 0, (g.z0 + g.z1) / 2);
  appendBox(M, geo, coloured);
  geo.dispose();
}

// round base puck: top face exactly at y=0 (feet stand ON the disc)
function appendDisc(M, body, coloured) {
  const r = Math.min(45, Math.max(6,
    Math.max(body.x1 - body.x0, body.z1 - body.z0) * 0.42));
  const geo = new THREE.CylinderGeometry(r, r, BASE_T, 24).toNonIndexed();
  geo.translate(body.ground ? (body.ground.x0 + body.ground.x1) / 2 : 0,
    -BASE_T / 2,
    body.ground ? (body.ground.z0 + body.ground.z1) / 2 : 0);
  appendBox(M, geo, coloured);
  geo.dispose();
}

// ------------------------------------------------------------------ reporting

// pose-aware support warning (thresholds from the pose engine's applied pose)
function poseWarnings() {
  const cur = getPoseEngine()?.current;
  if (!cur) return [];
  const w = [];
  if (Math.abs(cur.tilt) > 12) w.push("BODY TILT - overhangs need supports");
  if (Math.max(cur.armL.raise, cur.armR.raise) > 100)
    w.push("RAISED ARM - support under the forearm");
  if (Math.max(cur.legL.knee, cur.legR.knee) > 60)
    w.push("BENT KNEE - support under the folded leg");
  if (cur.drop > 0.05) w.push("SIT POSE - legs end above the ground line");
  return w;
}

function assembleOBJ(M, report, { heightMm, thicknessMm, notes, coloured }) {
  // verify the manufactured bounds honestly in the comment header
  const bb = report.bbox;
  const lines = [
    "# PSX Character Creator - print OBJ (M9)",
    "# units: mm - Y up - origin at the base centre - feet plane at y=0",
    `# height ${fN(heightMm)}mm - wall ${fN(thicknessMm)}mm - `
      + `${coloured ? "vertex colours" : "single colour (geometry only)"}`,
    `# tris ${report.triCount} - shells ${report.shells}`
      + ` - open edges ${report.openEdges} - non-manifold ${report.nonManifoldEdges}`,
    `# flipped shells rewound: ${notes.rewound}`
      + ` - sheets solidified: ${notes.solidified}`
      + ` - thin parts thickened: ${notes.thickened}`,
    "# measure: a bbox/min-wall sanity report ships with the export UI;",
    "# no printability guarantee - run your slicer's repair step.",
    "o psx-character-print",
  ];
  const P = M.pos, C = M.col;
  const nv = P.length / 3;
  for (let i = 0; i < nv; i++) {
    lines.push(
      `v ${fN(P[i * 3])} ${fN(P[i * 3 + 1])} ${fN(P[i * 3 + 2])}`
      + (C ? ` ${fN(C[i * 3])} ${fN(C[i * 3 + 1])} ${fN(C[i * 3 + 2])}` : "")
    );
  }
  for (let i = 0; i < nv; i += 3)
    lines.push(`f ${i + 1} ${i + 2} ${i + 3}`);
  lines.push(`# bbox x ${fN(bb.x1 - bb.x0)} y ${fN(bb.y1 - bb.y0)}`
    + ` z ${fN(bb.z1 - bb.z0)} mm (y range ${fN(bb.y0)}..${fN(bb.y1)})`);
  return lines.join("\n") + "\n";
}
