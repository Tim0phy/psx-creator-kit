import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { createServer } from "vite";

// M4 verification: every base top/outer/bottom/socks/shoes item, both view
// sizes for the default outfit + one full layered outfit.

mkdirSync("shots", { recursive: true });

const server = await createServer({ server: { port: 5199 } });
await server.listen();

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const tris = {};
page.on("console", (m) => {
  const t = m.text();
  const match = t.match(/^\[psxcc\] (\w+): (\d+) tris/);
  if (match) tris[match[1]] = +match[2];
  if (t.startsWith("[psxcc] TOTAL")) console.log(t);
});
page.on("pageerror", (e) => console.log("PAGE ERROR:", e.message));

const CASES = [
  ["m4_default_tee_pants_sneaker", "", null],
  ["m4_top_longsleeve", "?top=top_longsleeve", null],
  ["m4_top_sweater", "?top=top_sweater", null],
  ["m4_outer_jacket", "?top=top_tee&outer=top_jacket", null],
  ["m4_bottom_shorts", "?bottom=bot_shorts", null],
  ["m4_bottom_short_skirt", "?bottom=bot_short_skirt", null],
  ["m4_bottom_long_skirt", "?bottom=bot_long_skirt", null],
  ["m4_socks_white_long", "?socks=socks_white_long", null],
  ["m4_socks_knee_stripe", "?socks=socks_knee_stripe", null],
  ["m4_layered_all", "?top=top_tee&outer=top_jacket&socks=socks_knee_stripe", null],
];

for (const [name, q, mobile] of CASES) {
  await page.setViewportSize(
    mobile ? { width: 390, height: 844 } : { width: 1024, height: 768 }
  );
  await page.goto(`http://localhost:5199/${q}`);
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    PSXCC.setAuto(false);
    PSXCC.controls.yaw = 0;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `shots/${name}.png` });
}

// both sizes, full layered out with socks + jacket + skirt
for (const [w, h, name] of [[1024, 768, "m4_all_desktop"], [390, 844, "m4_all_mobile"]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto(
    "http://localhost:5199/?top=top_sweater&outer=top_jacket&bottom=bot_short_skirt&socks=socks_knee_stripe"
  );
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    PSXCC.setAuto(false);
    PSXCC.controls.yaw = 0;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `shots/${name}.png` });
}

await browser.close();
await server.close();
writeFileSync("shots/m4-tris.json", JSON.stringify(tris, null, 2));
console.log("M4 tris:", JSON.stringify(tris));
console.log("shots saved");
