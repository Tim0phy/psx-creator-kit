import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 4 });

// A: default (top tee + pants + socks)
await page.goto("http://localhost:5199/?hair=none");
await page.waitForTimeout(400);
await page.evaluate(() => { PSXCC.setAuto(false); PSXCC.controls.yaw = 0; });
await page.waitForTimeout(200);
await page.screenshot({ path: "shots/m4_iso_gapA.png", clip: { x: 540, y: 400, width: 280, height: 380 } });

// B: top=tee, bottom=none
await page.goto("http://localhost:5199/?hair=none&bottom=none&socks=none&shoes=none");
await page.waitForTimeout(400);
await page.evaluate(() => { PSXCC.setAuto(false); PSXCC.controls.yaw = 0; });
await page.waitForTimeout(200);
await page.screenshot({ path: "shots/m4_iso_gapB.png", clip: { x: 540, y: 400, width: 280, height: 380 } });

// C: top=none default bottom
await page.goto("http://localhost:5199/?hair=none&top=none&socks=none&shoes=none");
await page.waitForTimeout(400);
await page.evaluate(() => { PSXCC.setAuto(false); PSXCC.controls.yaw = 0; });
await page.waitForTimeout(200);
await page.screenshot({ path: "shots/m4_iso_gapC.png", clip: { x: 540, y: 400, width: 280, height: 380 } });

await browser.close();
await server.close();
console.log("done");
