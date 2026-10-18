import * as THREE from "three";

// M9 export face: the live renderer draws the face on two decal planes in
// front of the head (main.js). For every export (GLB + OBJ + print) the face
// must live ON the head surface instead, otherwise converters/printers see a
// flat floating plane. This module owns the shared decal-rect constants and
// builds the export-only head geometry:
//   - the head's FRONT face triangles get UVs projected through the decal
//     rect, so the combined face canvas (skin + blush + eyes + mouth) maps
//     pixel-aligned exactly where the planes used to sit;
//   - triangles are reordered into two material groups: [face map, skin];
//     the live head geometry is never touched.
//
// The draw pipeline keeps the crisp PSX look: 32x32 layer canvases upscaled
// 4x nearest, opaque combined canvas so no alpha discard is needed on the
// head surface (the face region is a solid texture block).

// decal rect in head-LOCAL units (origin = head centre; matches the decal
// planes in main.js: PlaneGeometry(0.75, 0.66) at y -0.0941)
export const FACE_RECT = { cx: 0, cy: -0.0941, w: 0.75, h: 0.66 };

// combined canvas resolution = the face texture's native size (STYLE.md 3)
export const FACE_CANVAS_SIZE = 128;

// build the opaque combined face canvas from the live decal layers:
// skin base fill -> eyes(+blush) layer -> mouth layer, nearest-upscaled.
//
// CSS needs "#rrggbb": THREE.Color.getHexString() returns "rrggbb" WITHOUT the
// '#', and canvas silently IGNORES an invalid fillStyle (keeping its default
// BLACK). That was the M9 export bug where the whole face rect came out dark
// with only the eye whites left visible. Accepts either form; anything else
// warns and falls back to white.
function cssHex(hex) {
  const s = String(hex ?? "").replace(/^#/, "");
  if (/^[0-9a-f]{6}$/i.test(s)) return "#" + s;
  console.warn("[psxcc] combineFaceCanvas: invalid skin colour", hex);
  return "#ffffff";
}

export function combineFaceCanvas(skinHex, bigEyes, bigMouth) {
  const big = document.createElement("canvas");
  big.width = big.height = FACE_CANVAS_SIZE;
  const ctx = big.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  // skin base: the decal canvases are transparent, the head version repaints
  // the background so the whole face rect is opaque skin
  ctx.fillStyle = cssHex(skinHex);
  ctx.fillRect(0, 0, FACE_CANVAS_SIZE, FACE_CANVAS_SIZE);
  ctx.drawImage(bigEyes, 0, 0);
  ctx.drawImage(bigMouth, 0, 0);
  return big;
}

// face texture factory (nearest, no mipmaps: identical settings to makeFaceTexture)
export function makeFaceCanvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  return tex;
}

const v = new THREE.Vector3();

// uv for a head-local point projected along Z through the decal rect
function project(uv, x, y) {
  uv[0] = 0.5 + (x - FACE_RECT.cx) / FACE_RECT.w;
  uv[1] = 0.5 + (y - FACE_RECT.cy) / FACE_RECT.h;
}

// classify every triangle of the (non-indexed) head geometry, then rebuild:
//   group 0 = face triangles (normal.z avg > FACE_Z_KEEP)
//   group 1 = everything else, BoxGeometry UVs preserved (skin material may
//             receive a map in viewers; same 0..1 uvs as today)
function buildHeadExportGeometry(headMesh) {
  const src = headMesh.geometry;
  const pos = src.attributes.position;
  const nor = src.attributes.normal;
  const suv = src.attributes.uv;
  const triCount = pos.count / 3;
  const keepUV = !!suv;

  // pass 1: classify
  const isFace = [];
  let faceCount = 0;
  for (let t = 0; t < triCount; t++) {
    let nz = 0;
    for (let k = 0; k < 3; k++) {
      v.fromBufferAttribute(nor, t * 3 + k);
      nz += v.z;
    }
    const face = nz / 3 > 0.55; // plate + rounded front ring; hairline goes skin
    isFace.push(face);
    if (face) faceCount++;
  }
  if (faceCount === 0) return { geometry: null, faceTris: 0 };

  // pass 2: rebuild attributes in [face...|skin...] order
  const order = [];
  for (let t = 0; t < triCount; t++) if (isFace[t]) order.push(t);
  const skinStart = order.length;
  for (let t = 0; t < triCount; t++) if (!isFace[t]) order.push(t);
  const layout = order.map(() => 0);
  for (let i = skinStart; i < order.length; i++) layout[i] = 1;

  const out = new THREE.BufferGeometry();
  const oPos = new Float32Array(triCount * 9);
  const oNor = new Float32Array(triCount * 9);
  const oUV = new Float32Array(triCount * 6);
  const uv2 = [0, 0];
  for (let i = 0; i < order.length; i++) {
    const t = order[i];
    for (let k = 0; k < 3; k++) {
      const j = t * 3 + k, o = i * 9 + k * 3;
      oPos[o] = pos.getX(j); oPos[o + 1] = pos.getY(j); oPos[o + 2] = pos.getZ(j);
      oNor[o] = nor.getX(j); oNor[o + 1] = nor.getY(j); oNor[o + 2] = nor.getZ(j);
      if (layout[i] === 0) project(uv2, oPos[o], oPos[o + 1]);
      else if (keepUV) { uv2[0] = suv.getX(j); uv2[1] = suv.getY(j); }
      else { uv2[0] = 0; uv2[1] = 0; }
      oUV[i * 6 + k * 2] = uv2[0]; oUV[i * 6 + k * 2 + 1] = uv2[1];
    }
  }
  out.setAttribute("position", new THREE.BufferAttribute(oPos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(oNor, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(oUV, 2));
  out.addGroup(0, faceCount * 3, 0);
  out.addGroup(faceCount * 3, (triCount - faceCount) * 3, 1);
  out.computeBoundingSphere();
  return { geometry: out, faceTris: faceCount };
}

// public: build the export-only head clone geometry (triangles reordered,
// face group first with decal-rect UVs). Returns null when no face region
// was classified (should not happen on the chibi head).
export function buildHeadExport(headMesh) {
  return buildHeadExportGeometry(headMesh);
}
