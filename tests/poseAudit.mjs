import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { createServer } from "vite";

// Pose clipping audit: capture every pose preset across sample outfits
// (front full / side full / leg close) into shots/pose-audit so clips between
// legs, trousers, stockings and shoes can be reviewed side by side.

mkdirSync("shots/pose-audit", { recursive: true });

const server = await createServer({ server: { port: 5211 } });
await server.listen();

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 880, height: 660 } });
await page.goto("http://localhost:5211", { waitUntil: "load" });
await page.waitForTimeout(700);

const OUTFITS = [
  { tag: "pants", bottom: "bot_long_pants", shoes: "shoe_sneaker" },
  { tag: "shorts_boots", bottom: "bot_shorts", shoes: "shoe_knee_boots" },
  { tag: "long_skirt", bottom: "bot_long_skirt", shoes: "shoe_sneaker" },
  { tag: "jeans", bottom: "bot_lowrise_jeans", shoes: "shoe_sneaker" },
  { tag: "bare", bottom: null, shoes: null },
  { tag: "male_pants", body: "male", bottom: "bot_long_pants", shoes: "shoe_sneaker" },
];

// views: f = front full, s = side full, c = 3/4 leg close
const VIEWS = {
  f: { pos: [0, 1.05, 4.3], look: [0, 0.95, 0], yaw: 0 },
  s: { pos: [0, 1.05, 4.3], look: [0, 0.95, 0], yaw: Math.PI / 2 },
  c: { pos: [1.05, 0.75, 1.7], look: [0, 0.38, 0], yaw: 0.42 },
};

await page.evaluate(async () => {
  PSXCC.setAuto(false);
  document.getElementById("btnRotate")?.click?.(); // ensure auto is off
  document.getElementById("btnRotate")?.click?.();
});
await page.evaluate(() => {
  PSXCC.setAuto(false);
  PSXCC.controls.yaw = 0;
  // hide every overlay so only the character view remains visible
  for (const id of ["leftPanel", "rightPanel", "topBar", "categoryBar", "centreCol"]) {
    const el = document.getElementById(id);
    if (el) el.style.visibility = "hidden";
  }
});

const poses = await page.evaluate(() => PSXCC.pose.list());

for (const outfit of OUTFITS) {
  await page.evaluate((o) => {
    const s = PSXCC.state;
    s.body = o.body ?? "female";
    s.hair = { id: "hair_01", color: "#ffffff" };
    s.top = { id: "top_tee", colors: { main: "#e06060" } };
    s.outer = null;
    s.socks = null;
    s.bottom = o.bottom === null ? null
      : { id: o.bottom, colors: { main: o.body === "male" ? "#3a5ca8" : "#3a5ca8" } };
    s.shoes = o.shoes === null ? null
      : { id: o.shoes, colors: { main: "#e8913a" } };
    s.headwear = null; s.eyewear = null; s.neck = null; s.wrist = null; s.bag = null;
    PSXCC.applyAll();
    PSXCC.controls.yaw = 0;
  }, outfit);

  // leg-relevant presets only (the other presets keep legs at rest)
  for (const poseId of poses.filter((p) =>
    ["pose_default", "pose_walk", "pose_run", "pose_sit"].includes(p))) {
    await page.evaluate((id) => PSXCC.pose.preset(id), poseId);
    await page.waitForTimeout(120);
    const short = poseId.replace("pose_", "");
    for (const [key, v] of Object.entries(VIEWS)) {
      await page.evaluate((view) => {
        const cam = PSXCC.camera;
        cam.position.set(...view.pos);
        cam.lookAt(...view.look);
        PSXCC.controls.yaw = view.yaw;
      }, v);
      await page.waitForTimeout(60);
      // capture ONLY the WebGL canvas, bypassing the UI panels
      await page.locator("#view").screenshot({
        path: `shots/pose-audit/${outfit.tag}_${short}_${key}.png`,
      });
    }
  }
}

await browser.close();
await server.close();
console.log("pose audit shots saved to /shots/pose-audit");
