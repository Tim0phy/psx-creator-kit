import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import "./psxRenderer.js"; // keeps THREE.ColorManagement off app-wide

THREE.ColorManagement.enabled = false; // defensive: raw component space

// M8 GLB export (v2 fidelity redesign). The app stores COLOURS AS RAW SCREEN
// (sRGB-encoded) values, while the glTF spec expects LINEAR values in
// baseColorFactor / COLOR_0 — writing screen values directly makes the model
// render DARKER in every conformant viewer (the M8-v1 bug). v2 fixes the
// contract:
//   1. bake target screen colour = uniform x vertical gradient x Lambert
//      (exactly the runtime shader), then convert screen -> linear before it
//      goes into COLOR_0 (display roundtrip = original);
//   2. texture-bearing surfaces (face decals, patterns) keep their embedded
//      PNG byte-perfect (file bytes are sRGB-encoded, correct by spec) and
//      only carry the gradient x lighting scalar as vertex colour;
//   3. material.side / transparency / vertexColors are carried from the
//      source material (no blanket DoubleSide);
//   4. meshes WITHOUT normals (the paper hair strips) get flat normals baked
//      into the export clone so lit viewers do not break;
//   5. baseColorFactor stays pure white (default) -> no double darkening.
// The runtime pixel shader / post pipeline is still not stored in the GLB
// (documented in the UI note + STYLE.md). All stays local, nothing uploads.

const AMBIENT = 0.78;
const DIFFUSE = 0.26;
const lightDir = new THREE.Vector3(0.4, 1.0, 0.7).normalize();

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

// exact sRGB encode complement (what viewers do to display): linear -> screen
// inverse: screen value v (IEC 61966-2-1) -> linear
export function srgbToLinear(v) {
  if (v <= 0.04045) return v / 12.92;
  return Math.pow((v + 0.055) / 1.055, 2.4);
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

function bakeMesh(mesh) {
  // Colour bake needs the vertex's WORLD position (world-Y gradient) and world
  // normal (Lambert), but the exported GEOMETRY must stay in LOCAL space — the
  // clone keeps the full joint hierarchy (local transforms copied verbatim),
  // so applying matrixWorld to the stored positions would double-transform
  // every posed part (the M8-v2 bug).
  mesh.updateWorldMatrix(true, false);
  const normalM = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const vw = new THREE.Vector3();
  const n = new THREE.Vector3();
  const base = mesh.material?.isShaderMaterial
    ? mesh.material.uniforms?.color?.value ?? new THREE.Color("#ffffff")
    : null;
  const hasGrad = mesh.material?.isShaderMaterial;
  const map = mesh.material?.isShaderMaterial
    ? mesh.material.uniforms?.map?.value ?? null : null;
  const g0 = hasGrad ? mesh.material.uniforms?.gradient?.value ?? 0.16 : 0;
  const gMin = hasGrad ? mesh.material.uniforms?.gradMin?.value ?? 0 : 0;
  const gMax = hasGrad ? mesh.material.uniforms?.gradMax?.value ?? 1.9 : 1.9;
  // plain materials (e.g. the optional platform): flat colour, no gradient
  const plain = !hasGrad
    ? (mesh.material?.isMeshBasicMaterial ? mesh.material.color : new THREE.Color("#ffffff"))
    : null;

  const geo = mesh.geometry.clone(); // positions remain LOCAL (hierarchy-safe)
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    vw.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    n.fromBufferAttribute(nor, i).applyMatrix3(normalM).normalize();
    // scalar k = gradient x Lambert (identical math to the runtime shader);
    // plain/basic surfaces render unlit in the app -> k = 1 (colour as-is)
    let k = 1;
    if (hasGrad) {
      const f = Math.min(1, Math.max(0,
        (vw.y - gMin) / Math.max(gMax - gMin, 0.001)));
      const grad = 1 - g0 * (1 - f);
      const d = Math.max(0, n.dot(lightDir));
      k = grad * (AMBIENT + DIFFUSE * d);
    }
    // target SCREEN colour (what the app would display at this vertex)
    let cs;
    if (plain) cs = plain;
    else if (map) cs = new THREE.Color(1, 1, 1); // texture provides the colour;
      // k rides COLOR_0 (see comment above)
    else cs = base;
    colors[i * 3] = srgbToLinear(Math.min(1, Math.max(0, cs.r * k)));
    colors[i * 3 + 1] = srgbToLinear(Math.min(1, Math.max(0, cs.g * k)));
    colors[i * 3 + 2] = srgbToLinear(Math.min(1, Math.max(0, cs.b * k)));
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const out = new THREE.Mesh(geo, bakeMaterial(mesh.material));
  out.name = mesh.name;
  // keep the mesh's OWN local transform (decals/soles/sleeves carry offsets);
  // without this every baked mesh collapses to its parent's origin
  out.position.copy(mesh.position);
  out.quaternion.copy(mesh.quaternion);
  out.scale.copy(mesh.scale);
  return out;
}

// bake the whole subtree and return a flat exportable clone (live scene untouched)
function cloneBakedFlat(src) {
  if (src.isMesh) return bakeMesh(src);
  const clone = new (src.constructor)();
  clone.name = src.name;
  // copy local transform exactly (the pose lives here)
  clone.position.copy(src.position);
  clone.rotation.copy(src.rotation);
  clone.quaternion.copy(src.quaternion);
  clone.scale.copy(src.scale);
  for (const child of src.children) {
    const c = cloneBakedFlat(child);
    if (c) clone.add(c);
  }
  return clone;
}

// export the current character (pose/colours/hair/clothes/accessories) as GLB.
// Helper/debug meshes excluded; stage platform only when includePlatform.
export async function exportCharacterGLB(
  { character, platform },
  { includePlatform = false, name = "" } = {}
) {
  if (!character) return { ok: false, errors: ["no character"] };
  const errors = [];
  const exportGroup = new THREE.Group();
  exportGroup.name = "psx-character";
  const bakedRoot = cloneBakedFlat(character.root);
  if (bakedRoot) exportGroup.add(bakedRoot);
  if (includePlatform && platform) {
    exportGroup.add(cloneBakedFlat(platform));
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
    // free the CLONED export geometries (the live scene originals keep living)
    exportGroup.traverse((o) => {
      if (o.isMesh && o.geometry) o.geometry.dispose();
    });
    exportGroup.clear();
    bakedMatCache.clear();
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

export { sanitiseName };
