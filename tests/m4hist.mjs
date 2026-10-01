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
  const imgdata = ctx.getImageData(0, 0, g.width, g.height).data;
  const hist = new Map();
  for (let y = 150; y < g.height; y += 1)
    for (let x = 150; x < 350; x += 1) {
      const i = (y * g.width + x) * 4;
      if (imgdata[i + 3] < 200) continue;
      const key = `${imgdata[i] >> 4},${imgdata[i + 1] >> 4},${imgdata[i + 2] >> 4}`;
      hist.set(key, (hist.get(key) ?? 0) + 1);
    }
  return [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25);
});
console.log(JSON.stringify(out, null, 1));
await browser.close();
await server.close();
