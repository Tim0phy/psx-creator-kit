import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 768, height: 640 }, deviceScaleFactor: 2 });

const shots = [
  ["pants", "?hair=none", 0],
  ["pants75", "?hair=none", Math.PI / 4],
  ["shorts", "?hair=none&bottom=bot_shorts", Math.PI / 4],
  ["shortskirt", "?hair=none&bottom=bot_short_skirt", Math.PI / 4],
  ["longskirt", "?hair=none&bottom=bot_long_skirt", Math.PI / 4],
];
for (const [name, url, yaw] of shots) {
  await page.goto(`http://localhost:5199/${url}`);
  await page.waitForTimeout(500);
  await page.evaluate((a) => { PSXCC.setAuto(false); PSXCC.controls.yaw = a; }, yaw);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `shots/m4_fix_${name}.png`, clip: { x: 330, y: 40, width: 440, height: 560 } });
}
await browser.close();
await server.close();
console.log("done");
