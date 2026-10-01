import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 768, height: 640 }, deviceScaleFactor: 4 });

await page.goto("http://localhost:5199/?hair=none&socks=socks_knee_stripe&top=top_longsleeve&outer=none");
await page.waitForTimeout(500);
await page.evaluate(() => { PSXCC.setAuto(false); PSXCC.controls.yaw = Math.PI / 8; });
await page.waitForTimeout(250);
await page.screenshot({ path: "shots/m4_fix2_zoom_sock.png", clip: { x: 340, y: 260, width: 250, height: 320 } });
await browser.close();
await server.close();
console.log("done");
