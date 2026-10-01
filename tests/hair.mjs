import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { createServer } from "vite";

mkdirSync("shots", { recursive: true });
const server = await createServer({ server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1100, height: 768 } });
await page.goto("http://localhost:5199");
await page.waitForTimeout(600);
await page.evaluate(() => PSXCC.setAuto(false));

// close-up of every hair style + none, front + 3/4 angle
const HAIRS = ["hair_01", "hair_02", "hair_03", "hair_04", "hair_05", "hair_06",
  "hair_07", "hair_08", "hair_09", "hair_10", "hair_11", null];
for (const id of HAIRS) {
  for (const [tag, yaw] of [["front", 0], ["angle", -0.6]]) {
    await page.evaluate(([i, y]) => {
      PSXCC.state.hair.id = i;
      PSXCC.controls.yaw = y;
      PSXCC.applyAll();
    }, [id, yaw]);
    await page.waitForTimeout(200);
    await page.screenshot({
      path: id ? `shots/${id}_${tag}.png` : `shots/hair_none_${tag}.png`,
      clip: { x: 460, y: 0, width: 640, height: 768 },
    });
  }
}
// hair panel UI
for (const id of ["hair_04", "hair_06", "hair_08", "hair_10"]) {
  await page.evaluate(([i]) => {
    PSXCC.state.hair.id = i;
    PSXCC.controls.yaw = Math.PI;
    PSXCC.applyAll();
  }, [id]);
  await page.waitForTimeout(200);
  await page.screenshot({
    path: `shots/${id}_back.png`,
    clip: { x: 460, y: 0, width: 640, height: 768 },
  });
}
await page.evaluate(() => PSXCC.controls.yaw = 0);
await page.click('[data-cat="head"]');
await page.waitForTimeout(200);
await page.screenshot({ path: "shots/hair_panel.png" });

await browser.close();
await server.close();
console.log("hair shots saved");
