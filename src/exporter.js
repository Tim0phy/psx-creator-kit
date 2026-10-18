import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { buildHeadExport, makeFaceCanvasTexture, combineFaceCanvas } from "./exportFace.js";
import "./psxRenderer.js"; // keeps THREE.ColorManagement off app-wide

THREE.ColorManagement.enabled = false; // defensive: raw component space

// Export pipeline shared by every format (M8 GLB / M9 OBJ):
//   cloneBakedFlat() rebuilds the posed character as a detached clone with
//   baked per-vertex colours; the live scene is never touched.
//
// Colour contract (M8 v2, unchanged): the app stores colours as RAW SCREEN
// (sRGB-encoded) values. glTF expects LINEAR in COLOR_0 (colourMode
// "linear", used by the GLB). OBJ viewers expect the perceptual/screen value
// (colourMode "raw", used by objExport.js) — same numbers as the hex pickers.
// Each vertex colour = base x world-Y gradient x Lambert (the exact runtime
// shader scalar); texture-bearing surfaces (face, patterns) keep their
// embedded PNGs and carry the scalar ramp (white base) in COLOR_0/RGB.
//
// M9 face: the decal planes (userData.exportRole "faceDecal") are dropped
// from every export; the head (exportRole "head") is rebuilt with its front
// face UV-mapped onto the combined face canvas (exportFace.js) so the face
// lives on the head surface, exactly where the planes visually sat.
// The runtime pixel / post pipeline is NOT stored in any export.

const AMBIENT = 0.78;
const DIFFUSE = 0.26;
const lightDir = new THREE.Vector3(0.4, 1.0, 0.7).normalize();
const WHITE = { r: 1, g: 1, b: 1 };

function sanitiseName(s) {
  const clean = String(s ?? "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "");
  return clean.slice(0, 24);
}

function stampYYYYMMDDHHMM() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function glbFilename(name) {
  const n = sanitiseName(name) || "character";
  return `psx-character-${n}-${stampYYYYMMDDHHMM()}.glb`;
}

export { sanitiseName, stampYYYYMMDDHHMM };

// exact sRGB encode complement (what viewers do to display): linear -> screen
// inverse: screen value v (IEC 61966-2-1) -> linear
export function srgbToLinear(v) {
  if (v <= 0.04045) return v / 12.92;
  return Math.pow((v + 0.055) / 1.055, 2.4);
}

// gradient x Lambert scalar for one vertex (identical math to the runtime
// shader), given the material's gradient uniforms
function gradientScalar(u, worldY) {
  const f = Math.min(1, Math.max(0, (worldY - u.gradMin) / Math.max(u.gradMax - u.gradMin, 0.001)));
  return 1 - u.gradient * (1 - f);
}

function lambertScalar(worldN) {
  return Math.max(0, worldN.dot(lightDir));
}

// bake one original material into a spec-correct unlit MeshBasicMaterial
const bakedMatCache = new Map();
function bakeMaterial(src) {
  if (bakedMatCache.has(src)) return bakedMatCache.get(src);
  const map = src?.uniforms?.map?.value ?? null;
  const side = src?.side ?? THREE.FrontSide;
  const out = new THREE.MeshBasicMaterial({
    color: 0xffffff, // stays the constant; all colour rides COLOR_0 / textures
    vertexColors: true,
    map: map ?? null,
    // decal/pattern canvases carry their own binary alpha (discard shader)
    transparent: !!map,
    side,
  });
  bakedMatCache.set(src, out);
  return out;
}

function bakeMesh(mesh, colourMode) {
  // Colour bake needs the vertex's WORLD position (world-Y gradient) and
  // world normal (Lambert), but the exported GEOMETRY stays in LOCAL space —
  // the clone keeps the full joint hierarchy (local transforms copied
  // verbatim), so applying matrixWorld to the stored positions would
  // double-transform every posed part (the M8-v2 bug).
  mesh.updateWorldMatrix(true, false);
  const normalM = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const vw = new THREE.Vector3();
  const n = new THREE.Vector3();
  const u = mesh.material?.uniforms ?? null;
  const isMapped = !!u?.map?.value;
  const gradU = isMapped ? null : {
    gradient: u.gradient?.value ?? 0.16,
    gradMin: u.gradMin?.value ?? 0,
    gradMax: u.gradMax?.value ?? 1.9,
  };
  const base = u?.color?.value
    ?? (mesh.material?.isMeshBasicMaterial ? mesh.material.color : new THREE.Color("#ffffff"));

  const geo = mesh.geometry.clone(); // positions remain LOCAL (hierarchy-safe)
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  const enc = colourMode === "raw" ? ((c) => c) : srgbToLinear;
  for (let i = 0; i < pos.count; i++) {
    vw.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    n.fromBufferAttribute(nor, i).applyMatrix3(normalM).normalize();
    let k = 1;
    if (gradU) k = gradientScalar(gradU, vw.y) * (AMBIENT + DIFFUSE * lambertScalar(n));
    // target SCREEN colour (what the app would display at this vertex);
    // mapped surfaces ride a white base so the texture is not tinted twice
    const cs = isMapped ? WHITE : base;
    colors[i * 3] = enc(Math.min(1, Math.max(0, cs.r * k)));
    colors[i * 3 + 1] = enc(Math.min(1, Math.max(0, cs.g * k)));
    colors[i * 3 + 2] = enc(Math.min(1, Math.max(0, cs.b * k)));
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const out = new THREE.Mesh(geo, bakeMaterial(mesh.material));
  out.name = mesh.name;
  // keep the mesh's OWN local transform (decals/soles/sleeves carry offsets);
  // without this every baked mesh collapses to its parent's origin
  out.position.copy(mesh.position);
  out.quaternion.copy(mesh.quaternion);
  out.scale.copy(mesh.scale);
  out.userData.matrixWorld = mesh.matrixWorld.clone();
  return out;
}

// M9: export-only head clone — face mapped ONTO the head surface.
// Group 0 (front-face triangles) samples the combined face canvas like a
// mapped surface (white base + k scalar); group 1 keeps the skin uniform
// colour (base x k). Single mesh, two material groups.
function bakeHead(headMesh, faceContext, colourMode) {
  const rebuilt = buildHeadExport(headMesh);
  if (!rebuilt || !rebuilt.geometry) return bakeMesh(headMesh, colourMode);
  const geo = rebuilt.geometry;
  const faceTex = makeFaceCanvasTexture(faceContext.combinedCanvas);
  const faceMat = new THREE.MeshBasicMaterial({
    color: 0xffffff, vertexColors: true, map: faceTex,
    transparent: false, // opaque combined canvas: no alpha needed
  });
  const skinMat = bakeMaterial(headMesh.material);
  const normalM = new THREE.Matrix3().getNormalMatrix(headMesh.matrixWorld);
  const u = headMesh.material?.uniforms ?? {};
  const gradU = {
    gradient: u.gradient?.value ?? 0.16,
    gradMin: u.gradMin?.value ?? 0,
    gradMax: u.gradMax?.value ?? 1.9,
  };
  const base = u.color?.value ?? new THREE.Color("#ffffff");
  const vw = new THREE.Vector3(), n = new THREE.Vector3();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const group = geo.groups[0]; // [0, faceCount) = face triangles
  const faceEnd = group.start + group.count;
  const colors = new Float32Array(pos.count * 3);
  const enc = colourMode === "raw" ? ((c) => c) : srgbToLinear;
  for (let i = 0; i < pos.count; i++) {
    vw.fromBufferAttribute(pos, i).applyMatrix4(headMesh.matrixWorld);
    n.fromBufferAttribute(nor, i).applyMatrix3(normalM).normalize();
    const k = gradientScalar(gradU, vw.y) * (AMBIENT + DIFFUSE * lambertScalar(n));
    const cs = i < faceEnd ? WHITE : base;
    colors[i * 3] = enc(Math.min(1, Math.max(0, cs.r * k)));
    colors[i * 3 + 1] = enc(Math.min(1, Math.max(0, cs.g * k)));
    colors[i * 3 + 2] = enc(Math.min(1, Math.max(0, cs.b * k)));
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const out = new THREE.Mesh(geo, [faceMat, skinMat]);
  out.name = headMesh.name; // "head"
  out.position.copy(headMesh.position);
  out.quaternion.copy(headMesh.quaternion);
  out.scale.copy(headMesh.scale);
  out.userData.matrixWorld = headMesh.matrixWorld.clone();
  return out;
}

// slot label for one ORIGINAL object for the OBJ object naming:
// nearest ancestor (or self) with a slot tag wins; skin body parts fall back
// by their joint chain. head/hair/ear/headwear/eyewear live under anchor_head.
let charRef = null; // set by bakeClone for the joint-chain body mapping
function computeExportSlot(src) {
  for (let o = src; o; o = o.parent) {
    if (o.userData?.slot) return o.userData.slot;
    if (o === charRef?.root) break;
  }
  // body fallback via joint chain names
  const names = [];
  for (let o = src.parent; o; o = o.parent) if (o.name) names.unshift(o.name);
  const chain = names.join("/");
  if (chain.includes("j_head")) return "head"; // e.g. bare sclera/hitboxes none
  return "body";
}

// walk the ORIGINAL tree and bake it clone-flat. faceMode:
//   null        -> decals exported plain (legacy path, unused by M9 UI)
//   faceContext -> face remapped onto the head; decal planes dropped
function cloneBakedFlat(src, faceContext, colourMode) {
  const role = src.userData?.exportRole;
  if (role === "faceDecal" && faceContext) return null;
  if (role === "head" && faceContext) {
    const out = bakeHead(src, faceContext, colourMode);
    out.userData.exportSlot = "head";
    return out;
  }
  if (src.isMesh) {
    const out = bakeMesh(src, colourMode);
    if (role === "faceDecal") out.userData.exportSlot = "face"; // legacy: kept out of UI flows
    else out.userData.exportSlot = computeExportSlot(src);
    return out;
  }
  const clone = new (src.constructor)();
  clone.name = src.name;
  // copy local transform exactly (the pose lives here)
  clone.position.copy(src.position);
  clone.rotation.copy(src.rotation);
  clone.quaternion.copy(src.quaternion);
  clone.scale.copy(src.scale);
  if (src.userData?.slot) clone.userData.slot = src.userData.slot;
  for (const child of src.children) {
    const c = cloneBakedFlat(child, faceContext, colourMode);
    if (c) clone.add(c);
  }
  return clone;
}

// face context for one export: the opaque combined canvas (skin + eyes +
// mouth). layers is either { eyesBig, mouthBig } (live decal canvases) or
// { canvas } (a caller-built combined canvas, used by the OBJ exporters so
// texture and head UVs share one image).
export function makeFaceContext(skinHex, layers) {
  if (layers?.canvas) return { combinedCanvas: layers.canvas };
  if (!layers?.eyesBig || !layers?.mouthBig) return null;
  const combinedCanvas = combineFaceCanvas(skinHex, layers.eyesBig, layers.mouthBig);
  return combinedCanvas ? { combinedCanvas } : null;
}

// export-shape: detached clone of the posed character (name "psx-character").
// colourMode: "linear" (glTF) | "raw" (OBJ viewers). Caller owns disposal.
export function bakeClone({ character, face }, { colourMode = "linear", neutralYaw = false } = {}) {
  character.root.updateMatrixWorld(true);
  charRef = character;
  const faceContext = face
    ? makeFaceContext(character.mats.skin.uniforms.color.value.getHexString(), face)
    : null;
  const exportGroup = new THREE.Group();
  exportGroup.name = "psx-character";
  const bakedRoot = cloneBakedFlat(character.root, faceContext, colourMode);
  if (!bakedRoot) return null;
  exportGroup.add(bakedRoot);
  if (neutralYaw) bakedRoot.rotation.y = 0; // bake pose without turntable yaw
  charRef = null;
  return exportGroup;
}

// legacy-compatible GLB export (Photo Studio / GLB button)
export async function exportCharacterGLB(
  { character, platform, face },
  { includePlatform = false, name = "" } = {}
) {
  if (!character) return { ok: false, errors: ["no character"] };
  const errors = [];
  const exportGroup = bakeClone({ character, face }, { colourMode: "linear" });
  if (includePlatform && platform) {
    exportGroup.add(cloneBakedFlat(platform, null, "linear"));
  }

  let blob = null;
  try {
    const exporter = new GLTFExporter();
    const result = await exporter.parseAsync(exportGroup, {
      binary: true,
      onlyVisible: true,
    });
    blob = new Blob([result], { type: "model/gltf-binary" });
  } catch (err) {
    errors.push(String(err?.message ?? err));
  } finally {
    // free the CLONED export resources (live scene originals keep living)
    disposeClone(exportGroup);
  }
  if (blob && blob.size === 0) {
    errors.push("empty GLB blob");
    blob = null;
  }
  return {
    ok: !!blob,
    blob,
    filename: glbFilename(name),
    errors,
  };
}

// detached disposal of a baked clone tree (cloned geometries + baked mats +
// the head's canvas texture). Live scene resources are untouched.
export function disposeClone(root) {
  if (!root) return;
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) { m.map?.dispose(); m.dispose(); }
  });
  root.clear();
  bakedMatCache.clear();
}
