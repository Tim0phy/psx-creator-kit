import * as THREE from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import "./psxRenderer.js";

THREE.ColorManagement.enabled = false;

// M8 GLB export. Built-in one-time bake: clone the posed character subtree and
// replace every custom ShaderMaterial with an unlit MeshBasicMaterial carrying
// BAKED vertex colours:
//   color = uniform color x vertical gradient x (ambient + diffuse . dot(n, L))
// Gouraud at the model's true vertex resolution -> any GL viewer shows the same
// flat PSX shading. The runtime pixel shader / post pipeline is NOT stored in
// the GLB (documented in the UI note + STYLE.md). Eye/mouth/pattern/decal
// textures go along as embedded PNGs. All stays local, nothing uploads.

const BAKED_MESH_KEY = "__psxExportMesh";
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

// bake one original material into an unlit MeshBasicMaterial + colour attr
const bakedMatCache = new Map();
function bakeMaterial(src) {
  if (bakedMatCache.has(src)) return bakedMatCache.get(src);
  const map = src?.uniforms?.map?.value ?? null;
  const out = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    map: map ?? null,
    // decal/pattern canvases carry their own alpha (discard shader) -> BLEND
    transparent: !!map,
    side: THREE.DoubleSide, // paper hair strips are double-sided in PSX too
  });
  bakedMatCache.set(src, out);
  return out;
}

function bakeMesh(mesh) {
  // world Y gradient + lighting baked per vertex (posed world transforms)
  mesh.updateWorldMatrix(true, false);
  const normalM = new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld);
  const v = new THREE.Vector3();
  const n = new THREE.Vector3();
  const lit = new THREE.Color();
  const base = mesh.material?.isShaderMaterial
    ? mesh.material.uniforms?.color?.value ?? new THREE.Color("#ffffff")
    : new THREE.Color("#ffffff");
  const hasGrad = mesh.material?.isShaderMaterial;
  const g0 = hasGrad ? mesh.material.uniforms?.gradient?.value ?? 0.16 : 0;
  const gMin = hasGrad ? mesh.material.uniforms?.gradMin?.value ?? 0 : 0;
  const gMax = hasGrad ? mesh.material.uniforms?.gradMax?.value ?? 1.9 : 1.9;
  // fallback: no ShaderMaterial (e.g. ground) -> plain colour, no gradient
  const plain = !hasGrad
    ? mesh.material?.isMeshBasicMaterial ? mesh.material.color : new THREE.Color("#ffffff")
    : null;

  const geo = mesh.geometry.clone();
  const pos = geo.attributes.position;
  const nor = geo.attributes.normal;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    // paper-strip geometries carry NO normal attribute: the runtime shader
    // samples the default (0,0,0) -> dot(x, L) = 0 -> ambient-only. Bake the
    // same (zero normal) so the exported lighting matches the live look.
    if (nor) n.fromBufferAttribute(nor, i).applyMatrix3(normalM).normalize();
    else n.set(0, 0, 0);
    let c;
    if (plain) c = plain;
    else {
      c = base;
      // vertical gradient, matches the GLSL (world Y, not pose-local)
      const f = Math.min(1, Math.max(0, (v.y - gMin) / Math.max(gMax - gMin, 0.001)));
      c = lit.copy(c).multiplyScalar(1 - g0 * (1 - f));
    }
    const d = Math.max(0, n.dot(lightDir));
    const k = AMBIENT + DIFFUSE * d;
    colors[i * 3] = Math.min(1, Math.max(0, c.r * k));
    colors[i * 3 + 1] = Math.min(1, Math.max(0, c.g * k));
    colors[i * 3 + 2] = Math.min(1, Math.max(0, c.b * k));
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const out = new THREE.Mesh(geo, bakeMaterial(mesh.material));
  out.name = mesh.name;
  return out;
}

// bake the whole subtree and return a flat exportable clone (live scene untouched)
function cloneBakedFlat(src) {
  if (src.isMesh) {
    const m = bakeMesh(src);
    if (m) m[BAKED_MESH_KEY] = true;
    return m;
  }
  const clone = new (src.constructor)();
  clone.name = src.name;
  // copy local transform exactly (pose lives here)
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

// Export the current character (pose/colours/hair/clothes/accessories) as a GLB blob.
// SRT helpers/debug meshes excluded; stage platform only when includePlatform.
export async function exportCharacterGLB({ character, platform }, { includePlatform = false, name = "" } = {}) {
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
