import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 768, height: 640 }, deviceScaleFactor: 2 });

const shots = [
  ["pants_shoes", "?hair=none", Math.PI / 8, true],
  ["pants_back", "?hair=none", Math.PI * 0.92, true],
  ["socks_shoes", "?hair=none&socks=socks_knee_stripe", Math.PI / 8, true],
  ["shorts", "?hair=none&bottom=bot_shorts", Math.PI / 8, true],
  ["shorts_side", "?hair=none&bottom=bot_shorts", Math.PI / 2, true],
];
for (const [name, url, yaw, keep] of shots) {
  await page.goto(`http://localhost:5199/${url}`);
  await page.waitForTimeout(500);
  await page.evaluate((a) => { PSXCC.setAuto(false); PSXCC.controls.yaw = a; }, yaw);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `shots/m4_fix2_${name}.png`, clip: { x: 330, y: 40, width: 440, height: 560 } });
}
await browser.close();
await server.close();
console.log("done");
