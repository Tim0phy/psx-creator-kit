import { chromium } from "playwright";
import { createServer } from "vite";

const server = await createServer({ server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 3 });
await page.goto("http://localhost:5199/?top=none&bottom=bot_shorts");
await page.waitForTimeout(400);
await page.evaluate(() => {
  PSXCC.setAuto(false);
  PSXCC.controls.yaw = 0;
});
await page.waitForTimeout(200);
const info = await page.evaluate(() =>
  PSXCC.character.root.children.map((c, i) => ({
    i, type: c.type,
    y: c.position.y,
    colors: (c.material?.uniforms?.color?.value?.getHexString?.() ?? "").slice(0, 6),
    kids: c.children?.length ?? 0,
  }))
);
console.log(JSON.stringify(info));
for (const { i, colors } of info) {
  await page.evaluate((i) => {
    for (const k of characterRoot()) k.visible = true;
    characterRoot()[i].visible = false;
    function characterRoot() { return window.PSXCC.character.root.children; }
  }, i);
  await page.waitForTimeout(150);
  await page.screenshot({
    path: `shots/m4part_${i}_${colors}.png`,
    clip: { x: 560, y: 330, width: 240, height: 200 },
  });
}
await browser.close();
await server.close();
console.log("done");
