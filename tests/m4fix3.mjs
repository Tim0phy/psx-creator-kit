import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 768, height: 640 }, deviceScaleFactor: 5 });

for (const [name, url] of [
  ["pants", "?hair=none&socks=none"],
  ["pants_socks", "?hair=none&socks=socks_knee_stripe"],
  ["shorts", "?hair=none&bottom=bot_shorts"],
  ["bare", "?hair=none&socks=none&bottom=none&shoes=shoe_sneaker"],
]) {
  await page.goto(`http://localhost:5199/${url}`);
  await page.waitForTimeout(500);
  await page.evaluate(() => { PSXCC.setAuto(false); PSXCC.controls.yaw = Math.PI / 10; });
  await page.waitForTimeout(250);
  await page.screenshot({ path: `shots/m4_fix3_${name}.png`, clip: { x: 420, y: 280, width: 220, height: 300 } });
}
await browser.close();
await server.close();
console.log("done");
