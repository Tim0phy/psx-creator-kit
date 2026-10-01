import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 768, height: 640 }, deviceScaleFactor: 2 });
page.on("console", (m) => console.log(m.text()));

await page.goto("http://localhost:5199/?outer=top_jacket");
await page.waitForTimeout(400);
await page.evaluate(() => {
  PSXCC.setAuto(false);
  PSXCC.controls.yaw = 0;
});
await page.waitForTimeout(200);
await page.screenshot({ path: "shots/m4_jacket_front.png" });

// side check (lapel + sleeves)
await page.evaluate(() => { PSXCC.controls.yaw = Math.PI / 2; });
await page.waitForTimeout(200);
await page.screenshot({ path: "shots/m4_jacket_side.png" });

await browser.close();
await server.close();
console.log("done");
