import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { createServer } from "vite";

// per-hair screenshots: index.html?hair=hair_XX
mkdirSync("shots", { recursive: true });

const server = await createServer({ server: { port: 5199 } });
await server.listen();

const browser = await chromium.launch({ channel: "msedge" });
const styles = [
  "hair_01", "hair_02", "hair_03", "hair_04", "hair_05", "hair_06",
  "hair_07", "hair_08", "hair_09", "hair_10", "hair_11", "hair_none",
];
const views = { front: 0, angle: 0.6, back: Math.PI };

for (const id of styles) {
  for (const [view, yaw] of Object.entries(views)) {
    const page = await browser.newPage({ viewport: { width: 640, height: 768 } });
    await page.goto(`http://localhost:5199/?hair=${id}`);
    await page.waitForTimeout(400);
    await page.evaluate((y) => {
      if (window.PSXCC) {
        if (PSXCC.setAuto) PSXCC.setAuto(false);
        PSXCC.controls.yaw = y;
      }
    }, yaw);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `shots/${id}_${view}.png` });
    await page.close();
  }
}
await browser.close();
await server.close();
console.log("hair shots saved to /shots");
