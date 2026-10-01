import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { createServer } from "vite";

mkdirSync("shots", { recursive: true });
const server = await createServer({ server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1100, height: 620 } });
await page.goto("http://localhost:5199");
await page.waitForTimeout(600);

// composite contact sheet: 12 eyes, 6 mouths, blush on/off — drawn by the
// same procedural code as the live texture.
await page.evaluate(async () => {
  const m = await import("/src/faceTexture.js");
  const skin = "#f5d5bf";
  const cell = 40; // 32x32 upscaled 4x per face
  const cols = 6;
  const rows = 4;
  const grid = document.createElement("canvas");
  grid.width = cols * cell;
  grid.height = rows * cell;
  grid.style.position = "fixed";
  grid.style.left = "0px";
  grid.style.top = "0px";
  grid.style.zIndex = "9999";
  document.body.appendChild(grid);
  const gctx = grid.getContext("2d");
  gctx.imageSmoothingEnabled = false;
  let n = 0;
  for (let e = 1; e <= 12; e++) {
    const mini = document.createElement("canvas");
    mini.width = mini.height = 32;
    m.drawFace32(mini.getContext("2d"), { skin, eyes: e, mouth: 0 });
    gctx.drawImage(mini, (n % cols) * cell, Math.floor(n / cols) * cell, cell, cell);
    n++;
  }
  for (let mo = 1; mo <= 6; mo++) {
    const mini = document.createElement("canvas");
    mini.width = mini.height = 32;
    m.drawFace32(mini.getContext("2d"), { skin, eyes: 1, mouth: mo });
    gctx.drawImage(mini, (n % cols) * cell, Math.floor(n / cols) * cell, cell, cell);
    n++;
  }
  const mini = document.createElement("canvas");
  mini.width = mini.height = 32;
  m.drawFace32(mini.getContext("2d"), { skin, eyes: 1, mouth: 1, blush: true });
  gctx.drawImage(mini, (n % cols) * cell, Math.floor(n / cols) * cell, cell, cell);
});

await page.waitForTimeout(200);
await page.screenshot({ path: "shots/faces_grid.png" });

// live character with each of a few options (sanity)
const shots = [];
for (const eyes of [1, 4, 7, 10]) {
  await page.evaluate((e) => {
    PSXCC.state.eyes = e;
    PSXCC.setAuto(false);
    PSXCC.controls.yaw = 0;
  }, eyes);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `shots/eyes_${eyes}.png`, clip: { x: 0, y: 0, width: 800, height: 768 } });
}
for (const mouth of [1, 3, 6]) {
  await page.evaluate((mo) => {
    PSXCC.state.mouth = mo;
  }, mouth);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `shots/mouth_${mouth}.png`, clip: { x: 0, y: 0, width: 800, height: 768 } });
}
await page.evaluate(() => {
  PSXCC.state.blush = true;
});
await page.waitForTimeout(150);
await page.screenshot({ path: "shots/blush.png", clip: { x: 0, y: 0, width: 800, height: 768 } });
const skins = await page.evaluate(() => document.querySelectorAll(".swatchBtn").length);
console.log("skin swatches:", skins);

await browser.close();
await server.close();
console.log("face option shots saved");
