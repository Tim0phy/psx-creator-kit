import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: "msedge" });

const cases = [
  ["m4_zoom_shorts", "?bottom=bot_shorts", { width: 1024, height: 768 }],
  ["m4_zoom_socks", "?socks=socks_knee_stripe", { width: 1024, height: 768 }],
];
for (const [name, q, size] of cases) {
  const page = await browser.newPage({
    viewport: size,
    deviceScaleFactor: 4,
  });
  await page.goto(`http://localhost:5199/${q}`);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    PSXCC.setAuto(false);
    PSXCC.controls.yaw = 0;
  });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: `shots/${name}.png`,
    clip: { x: 540, y: 150, width: 280, height: 360 },
  });
  await page.close();
}
await browser.close();
await server.close();
console.log("zoom shots saved");
