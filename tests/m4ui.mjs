import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2 });
await page.goto("http://localhost:5199/");
await page.waitForTimeout(400);
await page.evaluate(() => {
  PSXCC.setAuto(false);
  PSXCC.controls.yaw = 0;
});
await page.waitForTimeout(200);

const cats = ["top", "bottom", "shoes"];
const out = {};
for (const cat of cats) {
  await page.click(`.catBtn[data-cat="${cat}"]`);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `shots/m4ui_${cat}.png` });
  // click item 1 (or 2 for outer/socks sections?) => later slots: pick item then change colour
  const title = await page.textContent("#panelTitle");
  const swatches = await page.$$eval(".swatchBtn", (b) => b.map((x) => x.dataset.sw));
  out[cat] = { title, swatches: swatches.slice(0, 5) };
  // set custom colour per visible picker and confirm state saved + onChange applied
  const customs = await page.$$(".customSkin");
  await customs[0]?.evaluate((c) => {
    c.value = "#22aa66";
    c.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: `shots/m4ui_${cat}_custom.png` });
  const stateSlot = ["top", "bottom", "shoes"][cats.indexOf(cat)];
  out[cat].stateAfter = await page.evaluate((s) => PSXCC.state[s], stateSlot);
}
console.log(JSON.stringify(out, null, 1));
await browser.close();
await server.close();
