import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 4 });
await page.goto("http://localhost:5199/?top=none");
await page.waitForTimeout(400);
await page.evaluate(() => {
  PSXCC.setAuto(false);
  PSXCC.controls.yaw = 0;
});
await page.waitForTimeout(200);
await page.screenshot({
  path: "shots/m4_zoom_notop.png",
  clip: { x: 540, y: 150, width: 280, height: 360 },
});
await browser.close();
await server.close();
console.log("done");
