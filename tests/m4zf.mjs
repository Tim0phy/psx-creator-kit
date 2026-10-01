import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 768, height: 640 }, deviceScaleFactor: 2 });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));

await page.goto("http://localhost:5199/?outer=top_jacket");
await page.waitForTimeout(500);
await page.evaluate(() => { PSXCC.setAuto(false); });
await page.waitForTimeout(200);

// several yaw angles to catch z-fighting between top shell and outer shell
const angles = [0, Math.PI / 6, Math.PI / 3, Math.PI / 2, Math.PI];
for (let i = 0; i < angles.length; i++) {
  await page.evaluate((a) => { PSXCC.controls.yaw = a; }, angles[i]);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `shots/m4_zf_${i}.png`, clip: { x: 400, y: 40, width: 360, height: 480 } });
}
await browser.close();
await server.close();
console.log("done");
