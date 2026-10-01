import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
await page.goto("http://localhost:5199/?top=none&bottom=bot_shorts");
await page.waitForTimeout(400);
await page.evaluate(() => {
  PSXCC.setAuto(false);
  PSXCC.controls.yaw = 0;
});
await page.waitForTimeout(200);
const out = await page.evaluate(async () => {
  const cv = document.getElementById("view");
  const g = document.createElement("canvas");
  g.width = cv.width; g.height = cv.height;
  const ctx = g.getContext("2d");
  await new Promise((res) => setTimeout(res, 100));
  ctx.drawImage(cv, 0, 0);
  const img = ctx.getImageData(0, 0, g.width, g.height);
  const data = img.data;
  // find pure red hues: hue ~ 0/360 area
  const found = [];
  for (let y = 0; y < g.height; y += 2)
    for (let x = 0; x < g.width; x += 2) {
      const i = (y * g.width + x) * 4;
      const r = data[i], gg = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a > 200 && r > 150 && gg < 150 && b < 150 && r - Math.max(gg, b) > 60) {
        found.push([x, y, r, gg, b]);
      }
    }
  const colors = [...new Set(found.map(([_, __, r, gg, b]) => `${r >> 3},${gg >> 3},${b >> 3}`))];
  return { count: found.length, colors: colors.slice(0, 10), sample: found.slice(0, 30) };
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
await server.close();
