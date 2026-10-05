import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { createServer } from "vite";

mkdirSync("shots", { recursive: true });

// M8 GLB fidelity: export the posed character, load it with the MIS Default
// colour-managed pipeline (GLTFLoader + renderer, CM temporarily enabled to
// match standard viewers) and pixel-compare against the on-page capture at
// the same pose/yaw. Catches the M8-v1 "dark GLB" class of bugs.

const OUTFITS = [
  { label: "default", url: "http://localhost:5199/" },
  {
    label: "patterned",
    url: "http://localhost:5199/?hair=hair_07&top=top_knit_vest&outer=outer_blazer&bottom=bot_plaid_pleated&shoes=shoe_mary_jane&neck=acc_choker&pose=pose_wave",
  },
];

const server = await createServer({ server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => {
  const t = m.text();
  if (/GLTF|unlit|material/i.test(t)) console.log("CONSOLE:", t);
});

let failures = 0;

for (const outfit of OUTFITS) {
  await page.goto(outfit.url);
  await page.waitForTimeout(700);
  await page.evaluate(() => { PSXCC.setAuto(false); PSXCC.controls.yaw = 0; });
  await page.waitForTimeout(250);

  const res = await page.evaluate(async () => {
    // 1) the on-page reference capture (app-side pixels)
    const u = new Uint8Array(await (await PSXCC.capture({
      view: "front", scale: 1, background: "transparent", platform: false,
    })).arrayBuffer());
    let s = "";
    for (const c of u) s += String.fromCharCode(c);
    const refB64 = btoa(s);

    // 2) the GLB bytes
    const { exportCharacterGLB } = await import("/src/exporter.js");
    const r = await exportCharacterGLB(
      { character: PSXCC.character, platform: null },
      { includePlatform: false, name: "FID" }
    );
    if (!r.ok) return { error: "export failed: " + (r.errors ?? []).join(";") };

    // 3) reload with GLTFLoader under DEFAULT colour management (viewer-like)
    const { GLTFLoader } = await import("/@id/three/addons/loaders/GLTFLoader.js");
    const T = await import("/@id/three");
    // temporarily simulate a standard viewer: CM on (the app normally runs raw)
    T.ColorManagement.enabled = true;
    try {
      const loader = new GLTFLoader();
      const glbBuf = await r.blob.arrayBuffer();
      const parsed = await loader.parseAsync(glbBuf, "");
      const root = parsed.scene;

      root.updateMatrixWorld(true);
      const box = new T.Box3().setFromObject(root);
      const center = box.getCenter(new T.Vector3());
      const size = box.getSize(new T.Vector3());
      const FOV = 42;
      const tanY = Math.tan((FOV / 2) * (Math.PI / 180));
      const aspect = 480 / 360;
      const distY = (size.y / 2) / tanY;
      const distX = (size.x / 2) / (tanY * aspect);
      const dist = Math.max(distY, distX) * 1.07 + size.z / 2 + 0.05;
      const cam = new T.PerspectiveCamera(FOV, aspect, 0.05, dist * 4 + 10);
      const dir = new T.Vector3(0, -0.1, -4.3).normalize();
      cam.position.copy(center).addScaledVector(dir, -dist);
      cam.lookAt(center);

      const cv = document.createElement("canvas");
      cv.width = 480; cv.height = 360;
      const renderer = new T.WebGLRenderer({ canvas: cv, alpha: true, antialias: false });
      renderer.setClearColor(0x000000, 0);
      // sRGB output is the three default (explicitly stated for clarity)
      renderer.outputColorSpace = T.SRGBColorSpace;
      renderer.render(root, cam);
      const b = await new Promise((res) => cv.toBlob(res, "image/png"));
      const bu = new Uint8Array(await b.arrayBuffer());
      let bs = "";
      for (const ch of bu) bs += String.fromCharCode(ch);
      return { refB64: btoa(s), glbB64: btoa(bs), filename: r.filename };
    } finally {
      T.ColorManagement.enabled = false; // restore the app's raw space
    }
  });
  if (res.error) {
    console.log(`FAIL ${outfit.label}: ${res.error}`);
    failures++;
    continue;
  }
  writeFileSync(`shots/m8_glbref_${outfit.label}_app.png`, Buffer.from(res.refB64, "base64"));
  writeFileSync(`shots/m8_glbref_${outfit.label}_glb.png`, Buffer.from(res.glbB64, "base64"));

  // 4) pixel comparison
  const stat = await page.evaluate(async (o) => {
    const loadBmp = async (b) => createImageBitmap(
      await fetch(`data:image/png;base64,${b}`).then((x) => x.blob()));
    const [ia, ib] = await Promise.all([loadBmp(o.ref), loadBmp(o.glb)]);
    const mk = (img) => {
      const cv = document.createElement("canvas");
      cv.width = img.width; cv.height = img.height;
      const ctx = cv.getContext("2d");
      ctx.drawImage(img, 0, 0);
      return ctx.getImageData(0, 0, cv.width, cv.height).data;
    };
    const pa = mk(ia);
    const pb = mk(ib);
    let sum = 0; let big = 0; let n = 0;
    for (let i = 0; i < pa.length; i += 4) {
      const e = Math.max(
        Math.abs(pa[i] - pb[i]),
        Math.abs(pa[i + 1] - pb[i + 1]),
        Math.abs(pa[i + 2] - pb[i + 2]));
      sum += Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1])
        + Math.abs(pa[i + 2] - pb[i + 2]);
      if (e > 32) big++;
      n++;
    }
    return { mean: (sum / (n * 3)).toFixed(2), bigFrac: ((big / n) * 100).toFixed(2) + "%" };
  }, { ref: res.refB64, glb: res.glbB64 });
  console.log(`${outfit.label}: mean dR/dG/dB = ${stat.mean}/255, big pixel deltas>32 = ${stat.bigFrac}`);
}

console.log(errors.length ? "pageerrors: " + errors.join("; ") : "no pageerror");
await browser.close();
await server.close();
process.exit(failures || errors.length ? 1 : 0);
