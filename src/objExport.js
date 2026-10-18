import * as THREE from "three";
import { bakeClone, disposeClone, makeFaceContext } from "./exporter.js";
import { combineFaceCanvas } from "./exportFace.js";
import { makeZip, displayZipFilename, displayOBJFilename } from "./exportZip.js";

// M9 display OBJ export ("OBJ + textures (.zip)"):
//   character.obj  — v (world-baked, raw app units) + vt + vn, per-slot
//                    objects (head/hair/top/.../accessory_<id>) with
//                    per-mesh usemtl segments, plus the non-standard
//                    "v x y z r g b" vertex-colour extension
//   character.mtl  — one material per mesh (per group for the head); Kd
//                    references use RELATIVE paths; map_Kd carries the face
//                    canvas and pattern/decals at their ORIGINAL resolution
//                    (32/128 px, nearest look preserved — no resampling)
// Colour contract: everything the app renders as a flat colour still has a
// vertical gradient + Lambert at runtime, so ALL parts export with
// per-vertex colour (uniform x gradient x Lambert, raw screen values) and
// Kd stays pure WHITE so no viewer tints the colour twice (same contract
// as the GLB's white base + COLOR_0). The face is ON the head surface (no
// decal planes), textures keep their pixel look, nothing uploads.

const SLOT_ORDER = [
  "head", "hair", "headwear", "eyewear", "top", "outer", "bottom",
  "socks", "shoes", "neck", "wrist", "bag", "body",
];

const f3 = (n) => {
  const s = Number(n.toFixed(6));
  return Object.is(s, -0) ? "0" : String(s);
};

export function canvasToPNG(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob failed"))),
      "image/png"
    );
  });
}

// build the export clone + collect per-mesh records (slot -> materials)
function collectRecords(clone) {
  const records = [];
  clone.traverse((o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const slot = o.userData?.exportSlot ?? "body";
    records.push({
      mesh: o, slot, mtlIndex: records.length,
      mats: mats.map((mat) => ({ mat, mapCanvas: mat.map?.image ?? null })),
    });
  });
  return records;
}

// texture file names keyed by canvas identity (unique per pattern instance)
function assignTextureNames(records, faceCanvas) {
  const texFiles = new Map(); // canvas -> file name
  if (faceCanvas) texFiles.set(faceCanvas, "face.png");
  let n = 0;
  for (const r of records)
    for (const m of r.mats)
      if (m.mapCanvas && !texFiles.has(m.mapCanvas))
        texFiles.set(m.mapCanvas, `tex_${n++}.png`);
  return texFiles;
}

// assemble the OBJ + MTL text (pure string build over the baked clone)
export function assembleOBJ(clone, texFiles) {
  const records = collectRecords(clone);
  const obj = ["# PSX Character Creator - display OBJ (M9)", "mtllib character.mtl"];
  const mtl = ["# PSX Character Creator - display MTL (M9)"];
  let base = 0; // running vertex/uv/normal index offset (all advance together)
  let mtlN = 0;

  const slots = [...new Set(records.map((r) => r.slot))];
  slots.sort(
    (a, b) =>
      SLOT_ORDER.indexOf(a) - SLOT_ORDER.indexOf(b) ||
      String(a).localeCompare(String(b))
  );

  const v = new THREE.Vector3();
  const nv = new THREE.Vector3();
  for (const slot of slots) {
    obj.push(`o ${slot}`, "s off");
    for (const r of records.filter((x) => x.slot === slot)) {
      const mesh = r.mesh;
      const geo = mesh.geometry;
      const pos = geo.attributes.position;
      const nor = geo.attributes.normal;
      const uv = geo.attributes.uv ?? null;
      const col = geo.attributes.color ?? null;
      const mw = mesh.userData.matrixWorld ?? mesh.matrixWorld;
      const nmw = new THREE.Matrix3().getNormalMatrix(mw);
      const groups = Array.isArray(mesh.material)
        ? geo.groups
        : [{ start: 0, count: (geo.getIndex()?.count ?? pos.count), materialIndex: 0 }];

      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i).applyMatrix4(mw);
        nv
          .fromBufferAttribute(nor, i)
          .applyMatrix3(nmw)
          .normalize();
        const cr = col ? col.getX(i) : 1;
        const cg = col ? col.getY(i) : 1;
        const cb = col ? col.getZ(i) : 1;
        obj.push(
          `v ${f3(v.x)} ${f3(v.y)} ${f3(v.z)} ${f3(cr)} ${f3(cg)} ${f3(cb)}`
        );
        obj.push(`vt ${f3(uv?.getX(i) ?? 0)} ${f3(uv?.getY(i) ?? 0)}`);
        obj.push(`vn ${f3(nv.x)} ${f3(nv.y)} ${f3(nv.z)}`);
      }

      for (const g of groups) {
        const mat = (Array.isArray(mesh.material) ? mesh.material : [mesh.material])[g.materialIndex];
        const mtlName = `mtl_${slot}_${mtlN++}`;
        const mapCanvas = mat.map?.image ?? null;
        mtl.push(
          `newmtl ${mtlName}`,
          "Ka 0.0 0.0 0.0",
          "Kd 1.0 1.0 1.0", // colour rides the vertex RGB / texture (no tint)
          "Ks 0.0 0.0 0.0",
          "d 1.0",
          "illum 1"
        );
        if (mapCanvas && texFiles.has(mapCanvas)) {
          mtl.push(`map_Kd -clamp on ${texFiles.get(mapCanvas)}`);
        }
        obj.push(`usemtl ${mtlName}`);
        const indexed = geo.getIndex();
        const idx = indexed ? indexed.array : null;
        for (let i = g.start; i < g.start + g.count; i += 3) {
          const a = idx ? idx[i] : i;
          const b = idx ? idx[i + 1] : i + 1;
          const c = idx ? idx[i + 2] : i + 2;
          obj.push(
            `f ${base + a + 1}/${base + a + 1}/${base + a + 1}`
            + ` ${base + b + 1}/${base + b + 1}/${base + b + 1}`
            + ` ${base + c + 1}/${base + c + 1}/${base + c + 1}`
          );
        }
      }
      base += pos.count;
    }
  }
  return { objText: obj.join("\n") + "\n", mtlText: mtl.join("\n") + "\n", records };
}

// main entry: bake the posed character, write OBJ/MTL/textures, zip them.
export async function exportDisplayOBJ({ character, face }, { name = "" } = {}) {
  const skinHex = character.mats.skin.uniforms.color.value.getHexString();
  const faceCanvas = combineFaceCanvas(skinHex, face.eyesBig, face.mouthBig);
  const clone = bakeClone({ character, face: { canvas: faceCanvas } }, {
    colourMode: "raw",
  });
  if (!clone) throw new Error("bake failed");

  try {
    const texFiles = assignTextureNames(collectRecords(clone), faceCanvas);
    const { objText, mtlText } = assembleOBJ(clone, texFiles);
    // textures at ORIGINAL canvas resolution (nearest look preserved)
    const texData = {};
    for (const [canvas, fileName] of texFiles) {
      const blob = await canvasToPNG(canvas);
      texData[fileName] = new Uint8Array(await blob.arrayBuffer());
    }
    const zip = await makeZip({
      "character.obj": objText,
      "character.mtl": mtlText,
      ...texData,
    });
    let stats = { tris: 0, verts: 0, slots: 0, textures: texFiles.size };
    for (const [k, v] of Object.entries(stats)) stats[k] = v;
    clone.traverse((o) => {
      if (o.isMesh) {
        stats.verts += o.geometry.attributes.position.count;
        stats.tris += (o.geometry.getIndex()?.count ?? o.geometry.attributes.position.count) / 3;
      }
    });
    stats.slots = new Set(collectRecords(clone).map((r) => r.slot)).size;
    return {
      ok: true,
      blob: new Blob([zip], { type: "application/zip" }),
      filename: displayZipFilename(name),
      altFilename: displayOBJFilename(name),
      stats,
    };
  } finally {
    disposeClone(clone);
  }
}
