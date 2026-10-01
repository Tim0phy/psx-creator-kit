import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 4 });
const cases = [
  ["m4_zoom_shorts2", "?top=none&bottom=bot_shorts"],
  ["m4_zoom_pants_socks2", "?bottom=bot_long_pants&socks=socks_knee_stripe"],
];
const tris = [];
for (const [name, q] of cases) {
  const msgs = [];
  page.removeAllListeners("console");
  page.on("console", (m) => {
    if (m.text().includes("psxcc")) msgs.push(m.text());
  });
  await page.goto(`http://localhost:5199/${q}`);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    PSXCC.setAuto(false);
    PSXCC.controls.yaw = 0;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `shots/${name}.png`, clip: { x: 540, y: 150, width: 280, height: 360 } });
  const total = await page.evaluate(() => PSXCC.tris());
  tris.push({ name, tris: msgs, total });
}
await browser.close();
await server.close();
console.log(JSON.stringify(tris, null, 1));
