// M9 face-texture regression gate: the exported face image must carry the
// SKIN base (never black) plus the eye/mouth features, on BOTH routes:
//   - GLB        : texture embedded in the binary chunk
//   - OBJ + TEX  : face.png inside the zip
// The guarded bug: canvas silently ignores an invalid fillStyle (THREE
// Color.getHexString() returns bare "rrggbb", CSS needs "#rrggbb") and the
// fill then keeps the canvas default BLACK, so every exported face was dark.
// Run: node tests/m9Face.mjs
import { chromium } from "playwright";
import { createServer } from "vite";
import { unzipSync } from "fflate";

const PORT = 5203;
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

// --- unit: combineFaceCanvas accepts bare ("e8c8a8") and CSS hex -------------
const unit = await page.evaluate(async () => {
  const { combineFaceCanvas } = await import("/src/exportFace.js");
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    return c;
  };
  const eyes = mk(), mouth = mk();
  const corner = (fill) => {
    const c = combineFaceCanvas(fill, eyes, mouth);
    const d = c.getContext("2d").getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3]];
  };
  return { bare: corner("e8c8a8"), hashed: corner("#e8c8a8"), bogus: corner("not-a-colour") };
});
check("bare hex paints the skin colour",
  JSON.stringify(unit.bare) === JSON.stringify([232, 200, 168, 255]), JSON.stringify(unit.bare));
check("'#' hex paints the same skin colour",
  JSON.stringify(unit.hashed) === JSON.stringify(unit.bare), JSON.stringify(unit.hashed));
check("invalid colour falls back to opaque white",
  JSON.stringify(unit.bogus) === JSON.stringify([255, 255, 255, 255]), JSON.stringify(unit.bogus));

// --- GLB: decode the embedded face image ------------------------------------
const glb = await page.evaluate(async () => {
  const b64 = (u8) => {
    let s = ""; const C = 0x8000;
    for (let i = 0; i < u8.length; i += C) s += String.fromCharCode.apply(null, u8.subarray(i, i + C));
    return btoa(s);
  };
  const r = await PSXCC.exports.glb();
  if (!r.bytes) return { error: JSON.stringify(r.errors) };
  const bytes = r.bytes;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const total = dv.getUint32(8, true);
  let off = 12, json = null, binOff = 0;
  while (off < total) {
    const clen = dv.getUint32(off, true);
    const ctype = dv.getUint32(off + 4, true);
    if (ctype === 0x4E4F534A) json = JSON.parse(new TextDecoder().decode(bytes.subarray(off + 8, off + 8 + clen)));
    else binOff = off + 8;
    off += 8 + clen;
  }
  const bv = json.bufferViews[json.images[0].bufferView];
  const png = bytes.subarray(binOff + (bv.byteOffset || 0), binOff + (bv.byteOffset || 0) + bv.byteLength);
  const bmp = await createImageBitmap(new Blob([png], { type: "image/png" }));
  const cv = document.createElement("canvas");
  cv.width = bmp.width; cv.height = bmp.height;
  const ctx = cv.getContext("2d");
  ctx.drawImage(bmp, 0, 0);
  const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  let dark = 0;
  for (let p = 0; p < d.length; p += 4) {
    if (d[p] < 100 && d[p + 1] < 100 && d[p + 2] < 100) dark++;
  }
  return {
    skinHex: PSXCC.character.mats.skin.uniforms.color.value.getHexString(),
    size: [bmp.width, bmp.height], corner: [d[0], d[1], d[2], d[3]],
    darkPx: dark, textured: !!json.materials[0].pbrMetallicRoughness.baseColorTexture,
  };
});
if (glb.error) { console.log("FAIL glb export:", glb.error); fail++; }
else {
  const skin = [parseInt(glb.skinHex.slice(0, 2), 16), parseInt(glb.skinHex.slice(2, 4), 16),
    parseInt(glb.skinHex.slice(4, 6), 16)];
  check("glb face image is 128x128", glb.size[0] === 128 && glb.size[1] === 128, glb.size.join("x"));
  check("glb face corner == skin colour",
    [0, 1, 2].every((i) => Math.abs(glb.corner[i] - skin[i]) <= 1),
    `corner ${glb.corner.slice(0, 3)} vs skin ${skin}`);
  check("glb face corner is opaque", glb.corner[3] === 255, String(glb.corner[3]));
  check("glb face has eye/mouth features (dark px)", glb.darkPx > 50, String(glb.darkPx));
  check("head material carries the face texture", glb.textured);
}

// --- OBJ + TEX: face.png inside the zip --------------------------------------
const zipB64 = await page.evaluate(async () => {
  const r = await PSXCC.exports.displayOBJ();
  if (!r.bytes) return null;
  let s = ""; const C = 0x8000;
  for (let i = 0; i < r.bytes.length; i += C) s += String.fromCharCode.apply(null, r.bytes.subarray(i, i + C));
  return btoa(s);
});
if (!zipB64) { console.log("FAIL displayOBJ export"); fail++; }
else {
  const zip = unzipSync(new Uint8Array(Buffer.from(zipB64, "base64")));
  check("zip has face.png", zip["face.png"] !== undefined);
  const pngB64 = Buffer.from(zip["face.png"] ?? []).toString("base64");
  const face = await page.evaluate(async (b64png) => {
    const blob = await fetch(`data:image/png;base64,${b64png}`).then((x) => x.blob());
    const bmp = await createImageBitmap(blob);
    const cv = document.createElement("canvas");
    cv.width = bmp.width; cv.height = bmp.height;
    const ctx = cv.getContext("2d");
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
    let dark = 0;
    for (let p = 0; p < d.length; p += 4) {
      if (d[p] < 100 && d[p + 1] < 100 && d[p + 2] < 100) dark++;
    }
    return { corner: [d[0], d[1], d[2], d[3]], darkPx: dark };
  }, pngB64);
  check("face.png corner matches the GLB face corner",
    JSON.stringify(face.corner) === JSON.stringify(glb.corner ?? []),
    `${face.corner} vs ${glb.corner}`);
  check("face.png has eye/mouth features (dark px)", face.darkPx > 50, String(face.darkPx));
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log("page errors:", errors.length ? errors : "none");
await browser.close();
await server.close();
process.exit(fail || errors.length ? 1 : 0);
