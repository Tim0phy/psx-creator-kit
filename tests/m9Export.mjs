// M9 export test — display "OBJ + textures (.zip)" contract:
//   zip members (obj/mtl/png), MTL refs are RELATIVE and resolve to members,
//   the face decal planes are gone, all v lines carry 6 numeric tokens and
//   are NaN-free, and a THREE.OBJLoader re-import reproduces the live scene
//   bbox (yaw 0) within 0.02 app units.
// Run: node tests/m9Export.mjs
import { chromium } from "playwright";
import { createServer } from "vite";
import { unzipSync, strFromU8 } from "fflate";
import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

const PORT = 5196;
const server = await createServer({ server: { port: PORT } });
await server.listen();

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${detail}`); }
}

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 720, height: 640 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`http://localhost:${PORT}/`);
await page.waitForTimeout(900);
await page.evaluate(() => {
  if (window.PSXCC) { PSXCC.setAuto(false); PSXCC.controls.yaw = 0; }
});
await page.waitForTimeout(300);

const res = await page.evaluate(async () => {
  const r = await PSXCC.exports.displayOBJ();
  // live scene bbox (decal planes excluded — they are dropped in exports)
  const root = PSXCC.character.root;
  root.updateMatrixWorld(true);
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
  const walk = (o) => {
    if (o.isMesh && o.userData?.exportRole !== "faceDecal") {
      const p = o.geometry.attributes.position;
      const e = o.matrixWorld.elements;
      for (let i = 0; i < p.count; i++) {
        const x = p.array[i * 3], y = p.array[i * 3 + 1], z = p.array[i * 3 + 2];
        const wx = e[0] * x + e[4] * y + e[8] * z + e[12];
        const wy = e[1] * x + e[5] * y + e[9] * z + e[13];
        const wz = e[2] * x + e[6] * y + e[10] * z + e[14];
        if (wx < x0) x0 = wx; if (wx > x1) x1 = wx;
        if (wy < y0) y0 = wy; if (wy > y1) y1 = wy;
        if (wz < z0) z0 = wz; if (wz > z1) z1 = wz;
      }
    }
    for (const c of o.children) walk(c);
  };
  walk(root);
  return {
    bytes: Array.from(r.bytes), filename: r.filename, stats: r.stats,
    scene: { x0, y0, z0, x1, y1, z1 },
  };
});

// --- zip shape -----------------------------------------------------------------
const zip = unzipSync(new Uint8Array(res.bytes));
const members = Object.keys(zip);
check("zip has character.obj", zip["character.obj"] !== undefined, members.join(","));
check("zip has character.mtl", zip["character.mtl"] !== undefined);
check("zip has face.png", zip["face.png"] !== undefined);
const pngs = members.filter((m) => m.endsWith(".png"));
check("png members == stats.textures", pngs.length === res.stats.textures,
  `${pngs.length} vs ${res.stats.textures}`);
check("filename is a display zip", /^psx-character-.+-display-\d{8}-\d{4}\.zip$/.test(res.filename),
  res.filename);

const objText = strFromU8(zip["character.obj"]);
const mtlText = strFromU8(zip["character.mtl"]);

// --- OBJ text contract -----------------------------------------------------------
check("obj references character.mtl", /mtllib character\.mtl/.test(objText));
const vLines = objText.split("\n").filter((l) => /^v /.test(l));
const fLines = objText.split("\n").filter((l) => /^f /.test(l));
const vtLines = objText.split("\n").filter((l) => /^vt /.test(l));
check("obj has vertices", vLines.length > 0);
check("v lines carry colour (x y z r g b)",
  vLines.every((l) => l.trim().split(/ +/).length === 7),
  vLines.find((l) => l.trim().split(/ +/).length !== 7) ?? "");
check("v tokens all numeric + finite",
  vLines.every((l) => {
    const t = l.trim().split(/ +/).slice(1).map(Number);
    return t.length === 6 && t.every((n) => Number.isFinite(n));
  }), vLines.find((l) => !Number.isFinite(l)) ?? "");
check("f count == stats.tris", fLines.length === res.stats.tris,
  `${fLines.length} vs ${res.stats.tris}`);
check("v+vt+vn consistent", vtLines.length === vLines.length);
const objNames = (objText.match(/^o (.+)$/gm) ?? []).map((l) => l.slice(2));
check("no face-decal object", !objNames.includes("face"), objNames.join(","));
check("head object first (SLOT order)", objNames[0] === "head", objNames[0]);
const SLOT_ORDER = ["head", "hair", "headwear", "eyewear", "top", "outer",
  "bottom", "socks", "shoes", "neck", "wrist", "bag", "body"];
check("object names are slot tags", objNames.every((n) => SLOT_ORDER.includes(n)),
  objNames.join(","));
check("object blocks == stats.slots", objNames.length === res.stats.slots,
  `${objNames.length} vs ${res.stats.slots}`);
check("head face material present (2 usemtl in head block)",
  (objText.split(/^o head$/m)[1] ?? "").match(/^usemtl /gm)?.length >= 2);

// --- MTL contract -----------------------------------------------------------------
const mapRefs = (mtlText.match(/^map_Kd -clamp on (\S+)$/gm) ?? [])
  .map((l) => l.split(" ").pop());
check("Kd is pure white", (mtlText.match(/^Kd .*$/gm) ?? [])
  .every((l) => l === "Kd 1.0 1.0 1.0"), mtlText.match(/^Kd .*$/gm)?.join(" | "));
check("every map ref is relative", mapRefs.every((m) => !/[\\/:]|\.\./.test(m)),
  mapRefs.join(","));
check("every map ref resolves to a zip member", mapRefs.every((m) => zip[m] !== undefined),
  mapRefs.filter((m) => zip[m] === undefined).join(","));
check("face.png referenced by the MTL", mapRefs.includes("face.png"));
check("distinct map refs == png members",
  new Set(mapRefs).size === pngs.length, `${new Set(mapRefs).size} vs ${pngs.length}`);

// --- OBJLoader re-import bbox -----------------------------------------------------
const loader = new OBJLoader();
const re = loader.parse(objText);
const box = new THREE.Box3().setFromObject(re);
const s = res.scene;
const d = [
  Math.abs(box.min.x - s.x0), Math.abs(box.min.y - s.y0), Math.abs(box.min.z - s.z0),
  Math.abs(box.max.x - s.x1), Math.abs(box.max.y - s.y1), Math.abs(box.max.z - s.z1),
];
const TOL = 0.02;
check("OBJLoader bbox min matches scene", Math.max(d[0], d[1], d[2]) < TOL,
  `max diff ${Math.max(d[0], d[1], d[2]).toFixed(4)}`);
check("OBJLoader bbox max matches scene", Math.max(d[3], d[4], d[5]) < TOL,
  `max diff ${Math.max(d[3], d[4], d[5]).toFixed(4)}`);

console.log(`\n${pass} passed, ${fail} failed`);
console.log("page errors:", errors.length ? errors : "none");
await browser.close();
await server.close();
process.exit(fail || errors.length ? 1 : 0);
