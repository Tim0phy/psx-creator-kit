import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { createServer } from "vite";

mkdirSync("shots", { recursive: true });

const server = await createServer({ server: { port: 5199 } });
await server.listen();

const browser = await chromium.launch({ channel: "msedge" });
const sizes = [
  [1024, 768, "desktop.png"],
  [390, 844, "mobile.png"],
];
for (const [w, h, name] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto("http://localhost:5199");
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    if (window.PSXCC) {
      if (PSXCC.setAuto) PSXCC.setAuto(false);
      PSXCC.controls.yaw = 0;
    }
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `shots/${name}` });
  await page.close();
}
await browser.close();
await server.close();
console.log("shots saved to /shots");
