import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 768, height: 640 }, deviceScaleFactor: 5 });

const angles = { front: 0, side: Math.PI / 2, backfoot: Math.PI * 0.85 };
for (const [name, url] of [
  ["pants", "?hair=none&socks=none"],
  ["shorts", "?hair=none&bottom=bot_shorts&socks=none"],
  ["bare", "?hair=none&socks=none&bottom=none&shoes=shoe_sneaker"],
]) {
  for (const [aname, yaw] of Object.entries(angles)) {
    await page.goto(`http://localhost:5199/${url}`);
    await page.waitForTimeout(400);
    await page.evaluate((y) => { PSXCC.setAuto(false); PSXCC.controls.yaw = y; }, yaw);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `shots/m4_fix4_${name}_${aname}.png`, clip: { x: 420, y: 280, width: 220, height: 300 } });
  }
}
await browser.close();
await server.close();
console.log("done");
