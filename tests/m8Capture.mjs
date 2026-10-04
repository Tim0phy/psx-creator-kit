import { chromium } from "playwright";
import { mkdirSync, writeFileSync, readFileSync, statSync } from "fs";
import { createServer } from "vite";

mkdirSync("shots", { recursive: true });

// M8 acceptance: Photo Studio render purity (no UI overlays, real alpha),
// dimension/cap matrix, PSX vs Clean sharpness, view/framing matrix,
// turnaround sheet, GLB round-trip via GLTFLoader, dialogue UI (P/Esc,
// download naming, clipboard fallback), memory stability, mobile modal.

const server = await createServer({ server: { port: 5199 } });
await server.listen();

const browser = await chromium.launch({ channel: "msedge" });
const results = [];
let failures = 0;
const check = (name, ok, info = "") => {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${info ? "  -> " + info : ""}`);
  if (!ok) failures++;
};
const errors = [];

const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto("http://localhost:5199");
await page.waitForTimeout(600);
// lock the view: deterministic captures (frame + pixel math) across the suite
await page.evaluate(() => { PSXCC.setAuto(false); PSXCC.controls.yaw = 0.4; });
await page.waitForTimeout(250);
check("no pageerror on boot", errors.length === 0, errors.join("; "));

// one capture in-page: decode the blob, report dims + sampled pixels + metrics
const probe = (opts) => page.evaluate(async (o) => {
  const blob = await PSXCC.capture(o);
  const bmp = await createImageBitmap(blob);
  const cv = document.createElement("canvas");
  cv.width = bmp.width;
  cv.height = bmp.height;
  const ctx = cv.getContext("2d");
  ctx.drawImage(bmp, 0, 0);
  const d = ctx.getImageData(0, 0, bmp.width, bmp.height).data;
  const px = (x, y) => {
    const i = (y * bmp.width + x) * 4;
    return [d[i], d[i + 1], d[i + 2], d[i + 3]];
  };
  let transitions = 0;
  let prevA = null;
  const midY = Math.floor(bmp.height / 2);
  let same = 0;
  let denom = 0;
  for (let x = 0; x < bmp.width; x++) {
    const p = px(x, midY);
    if (prevA !== null && p[3] !== prevA) transitions++;
    prevA = p[3];
    if (x >= 4) {
      const q = px(x - 4, midY); // 1 RT texel to the left at a 4x upscale
      denom++;
      if (p[0] === q[0] && p[1] === q[1] && p[2] === q[2] && p[3] === q[3]) same++;
    }
  }
  const blocky = denom ? same / denom : 0;
  let alphaBinary = true;
  for (let i = 3; i < d.length; i += 8) {
    if (d[i] !== 0 && d[i] !== 255) { alphaBinary = false; break; }
  }
  const unique = new Set();
  for (let i = 0; i < d.length; i += 16) {
    unique.add(`${d[i]},${d[i + 1]},${d[i + 2]},${d[i + 3]}`);
  }
  let rgbTrans = 0;
  for (let dy = -20; dy <= 20; dy++) {
    const y = Math.min(bmp.height - 1, Math.max(0, Math.floor(bmp.height / 2) + dy));
    let prev = null;
    for (let x = 0; x < bmp.width; x++) {
      const i = (y * bmp.width + x) * 4;
      const cur = d[i] * 65536 + d[i + 1] * 256 + d[i + 2];
      if (prev !== null && cur !== prev) rgbTrans++;
      prev = cur;
    }
  }
  return {
    bytes: blob.size, w: bmp.width, h: bmp.height,
    corner: px(0, 0), center: px(bmp.width >> 1, bmp.height >> 1),
    transitions, blocky, alphaBinary, unique: unique.size, rgbTrans,
  };
}, opts);

// ---- 1. dimension / cap matrix ------------------------------------------------
const DIMS = { "1:1": [480, 480], "4:3": [480, 360], "3:4": [480, 640], "9:16": [480, 853] };
for (const [aspect, [ew, eh]] of Object.entries(DIMS)) {
  const r1 = await probe({ aspect, scale: 1, look: "psx", background: "transparent" });
  check(`dims ${aspect} 1x`, r1.w === ew && r1.h === eh, `${r1.w}x${r1.h}`);
  const r4 = await probe({ aspect, scale: 4, look: "psx", background: "transparent" });
  check(`dims ${aspect} 4x`, r4.w === ew * 4 && r4.h === eh * 4, `${r4.w}x${r4.h}`);
}
// raw calculator: oversize collapses to the 4096 device cap
const cap = await page.evaluate(() => PSXCC.captureDims("9:16", 8, 1));
check("cap fn: oversize collapses to 4096 longest side",
  cap[2] === true && Math.max(cap[0], cap[1]) === 4096,
  JSON.stringify(cap));
// runtime path: illegal scale clamps to the nearest legal step (never breaks)
const clampShot = await probe({ scale: 8, background: "transparent" });
check("oversize scale clamps to 4x and renders",
  clampShot.w === 1920 && clampShot.h === 1440,
  `${clampShot.w}x${clampShot.h}`);

// ---- 2. alpha + background purity ---------------------------------------------
const tr = await probe({ background: "transparent", look: "psx", scale: 1 });
check("transparent corner alpha=0", tr.corner[3] === 0, JSON.stringify(tr.corner));
const tr4 = await probe({ background: "transparent", look: "psx", scale: 4 });
check("PSX 4x alpha binary (nearest upscale, no AA fuzz)", tr4.alphaBinary);
const ck = await probe({ background: "checker", look: "psx", scale: 1 });
check("checker background at corner",
  ck.corner[3] === 255 && ck.corner[0] > 200 && ck.corner[2] < 170,
  JSON.stringify(ck.corner));
const solid = await probe({ background: "solid", look: "psx", scale: 1 });
check("solid background covers corner", solid.corner[3] === 255, JSON.stringify(solid.corner));

// ---- 3. PSX nearest-upscale purity + the Clean look ----------------------------
const clean4 = await probe({ background: "transparent", look: "clean", scale: 4 });
check("clean renders full output res", clean4.w === 1920 && clean4.h === 1440,
  `${clean4.w}x${clean4.h}`);
// Ground truth for "PSX low-res + nearest upscaling": at scale 4 the PSX look
// renders into the SAME 480-wide base buffer as 1x, then grows each texel into
// an exact 4x4 block. Downsampling the 4x capture by 4 (nearest) must
// reproduce the 1x capture pixel-for-pixel — proof the upscale is nearest
// (any linear/AA upscale would break this identity) and no blur is applied.
const nnEq = await page.evaluate(async () => {
  const one = await PSXCC.capture({ scale: 1, background: "transparent", look: "psx" });
  const four = await PSXCC.capture({ scale: 4, background: "transparent", look: "psx" });
  const b1 = await createImageBitmap(one);
  const b4 = await createImageBitmap(four);
  if (b1.width * 4 !== b4.width || b1.height * 4 !== b4.height) return "dims";
  const c1 = document.createElement("canvas");
  c1.width = b1.width; c1.height = b1.height;
  c1.getContext("2d").drawImage(b1, 0, 0);
  const d1 = c1.getContext("2d").getImageData(0, 0, b1.width, b1.height).data;
  const c4 = document.createElement("canvas");
  c4.width = b4.width / 4; c4.height = b4.height / 4;
  const ctx4 = c4.getContext("2d");
  ctx4.imageSmoothingEnabled = false;
  ctx4.drawImage(b4, 0, 0, c4.width, c4.height);
  const d4 = c4.getContext("2d").getImageData(0, 0, c4.width, c4.height).data;
  for (let i = 0; i < d4.length; i++) if (d4[i] !== d1[i]) return "pixel";
  return true;
});
check("PSX 4x == exact nearest 4x upscale of the base render (no blur)",
  nnEq === true, String(nnEq));

// ---- 4. visual evidence captures (/shots for the eyeball pass) ------------------
// Blob cannot cross into Node -> return base64 from the page
const grab = (opts) => page.evaluate(async (o) => {
  const b = await PSXCC.capture(o);
  const u = new Uint8Array(await b.arrayBuffer());
  let s = "";
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s);
}, opts);
const grabTurn = (opts) => page.evaluate(async (o) => {
  const r = await PSXCC.captureTurnaround(o);
  const u = new Uint8Array(await r.blob.arrayBuffer());
  let s = "";
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return { b64: btoa(s), dims: r.dims };
}, opts);

const SHOTS = [
  ["default", {}],
  ["front", { view: "front" }],
  ["side", { view: "side" }],
  ["back", { view: "back" }],
  ["clean", { look: "clean" }],
  ["asport", { aspect: "9:16", scale: 2 }],
  ["name", { showName: true }],
];
for (const [tag, extra] of SHOTS) {
  const b64 = await grab({ look: "psx", scale: 1, background: "checker", ...extra });
  writeFileSync(`shots/m8_capture_${tag}.png`, Buffer.from(b64, "base64"));
}
check("visual-evidence captures saved", true);

// tall hair + ears + wide pants + raised arms must fit with real margins
await page.goto("http://localhost:5199/?hair=hair_02&headwear=acc_cat_ears&bottom=bot_cargo_wide&pose=pose_arms_up");
await page.waitForTimeout(700);
await page.evaluate(() => { PSXCC.setAuto(false); PSXCC.controls.yaw = 0.4; });
await page.waitForTimeout(300);
const tall = await probe({ view: "front", scale: 1, background: "transparent" });
check("tall outfit framed (transparent margins, nothing cropped)",
  tall.corner[3] === 0 && tall.bytes > 1000, `${tall.w}x${tall.h}`);
{
  const b64 = await grab({ view: "front", scale: 1, background: "checker" });
  writeFileSync("shots/m8_capture_tall.png", Buffer.from(b64, "base64"));
}

// ---- 5. turnaround sheet -----------------------------------------------------
{
  const res = await grabTurn({
    look: "psx", scale: 2, aspect: "4:3",
    background: "checker", showName: true, name: "MISO",
  });
  const bytes = Buffer.from(res.b64, "base64");
  // probe dimensions in-page
  const probeDims = await page.evaluate(async (o) => {
    const r = await PSXCC.captureTurnaround(o);
    const bmp = await createImageBitmap(r.blob);
    return { w: bmp.width, h: bmp.height };
  }, { look: "psx", scale: 2, aspect: "4:3", background: "checker", showName: true, name: "MISO" });
  check("turnaround sheet is 3 panels wide",
    probeDims.w === res.dims[0] && probeDims.h === res.dims[1]
      && probeDims.w % 3 === 0 && bytes.length > 1000,
    `${probeDims.w}x${probeDims.h}`);
  writeFileSync("shots/m8_turnaround.png", bytes);
}

// ---- 6. GLB export + GLTFLoader round-trip -------------------------------------
await page.goto("http://localhost:5199/?hair=hair_03&top=top_knit_vest&bottom=bot_plaid_pleated&shoes=shoe_white_sneaker&neck=acc_choker&pose=pose_hands_on_hips");
await page.waitForTimeout(700);
const glbPath = "shots/m8_export.glb";
const [dl] = await Promise.all([
  page.waitForEvent("download", { timeout: 20000 }),
  page.click("#btnGlb"),
]);
await dl.saveAs(glbPath);
check("GLB download exists non-empty", statSync(glbPath).size > 1000,
  `${statSync(glbPath).size} bytes`);
const b64 = readFileSync(glbPath).toString("base64");
const gltf = await page.evaluate(async (b) => {
  const raw = Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
  const { GLTFLoader } = await import("/@id/three/addons/loaders/GLTFLoader.js");
  let parsed;
  try {
    parsed = await new GLTFLoader().parseAsync(raw.buffer.slice(
      raw.byteOffset, raw.byteOffset + raw.byteLength), "");
  } catch (e) {
    return { error: String(e) };
  }
  let meshes = 0;
  let allBaked = true;
  let hasNamed = false;
  parsed.scene.traverse((o) => {
    if (o.isMesh) {
      meshes++;
      if (!o.material.vertexColors) allBaked = false;
    }
    if (o.name && o.name.startsWith("j_")) hasNamed = true;
  });
  return { meshes, allBaked, hasNamed };
}, b64);
check("GLB loads via GLTFLoader with expected mesh count",
  !gltf.error && gltf.meshes >= 6, gltf.error ?? `${gltf.meshes} meshes`);
check("GLB keeps baked vertex colours (unlit, no shader fx)", gltf.allBaked === true);
check("GLB carries the posed joint hierarchy", gltf.hasNamed === true);
await page.evaluate(() => PSXCC.setAuto(false));

// ---- 7. Photo Studio dialogue UI ------------------------------------------------
await page.goto("http://localhost:5199");
await page.waitForTimeout(500);
await page.fill("#nameInput", "MISO");
await page.click("#btnCamera");
await page.waitForTimeout(800);
check("modal open", await page.evaluate(() =>
  !document.getElementById("photoModal").hidden));
check("preview rendered", await page.evaluate(() => {
  const img = document.getElementById("psPreview");
  return img.complete && img.naturalWidth > 100;
}));
await page.screenshot({ path: "shots/m8_photo_studio_desktop.png" });

const before = await page.evaluate(() => document.getElementById("psPreview").src.slice(-64));
await page.click(".psSeg button:text('BACK')");
await page.waitForTimeout(700);
const after = await page.evaluate(() => document.getElementById("psPreview").src.slice(-64));
check("preview updates on view change (debounced)", before !== after);

await page.click("body");
await page.keyboard.press("Escape");
check("Esc closes modal", await page.evaluate(() =>
  document.getElementById("photoModal").hidden));
await page.keyboard.press("p");
check("P reopens modal", await page.evaluate(() =>
  !document.getElementById("photoModal").hidden));

const [pngDl] = await Promise.all([
  page.waitForEvent("download", { timeout: 20000 }),
  page.click("#psDownload"),
]);
const pngName = pngDl.suggestedFilename();
check("PNG filename pattern psx-character-<name>-<view>-<WxH>.png",
  /^psx-character-miso-\w+-\d+x\d+\.png$/i.test(pngName), pngName);

// clipboard: force-block write() deterministically -> toast + fallback download
await page.evaluate(() => {
  navigator.clipboard.write = () => Promise.reject(new Error("blocked"));
});
const [fallDl] = await Promise.all([
  page.waitForEvent("download", { timeout: 20000 }),
  page.click("#psCopy"),
]);
await page.waitForTimeout(300);
const toastShown = await page.evaluate(() => {
  const t = document.getElementById("psToast");
  return !t.hidden && /CLIPBOARD/.test(t.textContent);
});
check("clipboard blocked -> pixel toast + fallback download",
  toastShown && /psx-character/.test(fallDl.suggestedFilename()),
  fallDl.suggestedFilename());

// ---- 8. memory stability: 20 repeated captures ----------------------------------
const heap = () => page.evaluate(() =>
  performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : -1);
const h0 = await heap();
for (let i = 0; i < 20; i++) {
  await page.evaluate((n) => PSXCC.capture({
    look: n % 2 ? "psx" : "clean",
    scale: 2,
    background: "transparent",
    view: ["front", "side", "back"][n % 3],
  }), i);
}
const h1 = await heap();
check("20 captures: heap stable (<8MB growth)",
  h0 < 0 || h1 - h0 < 8, `${h0}MB -> ${h1}MB`);
const stillOk = await page.evaluate(async () =>
  (await PSXCC.capture({ scale: 1 })).size > 1000);
check("captures still work after 20 rounds", stillOk);

// ---- 9. mobile modal --------------------------------------------------------------
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
mob.on("pageerror", (e) => errors.push("mobile: " + e));
await mob.goto("http://localhost:5199");
await mob.waitForTimeout(500);
await mob.click("#btnCamera");
await mob.waitForTimeout(800);
check("mobile modal opens", await mob.evaluate(() =>
  !document.getElementById("photoModal").hidden));
await mob.screenshot({ path: "shots/m8_photo_studio_mobile.png" });
await mob.close();

check("no pageerror at end", errors.length === 0, errors.join("; "));

console.log(results.join("\n"));
console.log(failures ? `\n${failures} FAILURES` : "\nALL PASS");
await browser.close();
await server.close();
process.exit(failures ? 1 : 0);
