import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "fs";
import { createServer } from "vite";

// M5: per-accessory screenshots. Each accessory item is mapped to its slot as
// a URL param (?headwear=acc_cat_ears etc.), captured front/angle/back.
mkdirSync("shots", { recursive: true });

const SLOT_ITEMS = {
  headwear: [
    "acc_cat_ears", "acc_bunny_ears", "acc_beanie", "acc_cap",
    "acc_bakerboy", "acc_butterfly_clip", "acc_z_hairband",
  ],
  eyewear: ["acc_glasses", "acc_wrap_sunglasses"],
  neck: ["acc_choker"],
  wrist: ["acc_friendship_bracelet"],
  bag: ["acc_baguette_bag", "acc_shoulder_bag"],
};
const views = { front: 0, angle: 0.6, back: Math.PI };

const server = await createServer({ server: { port: 5199 } });
await server.listen();
const browser = await chromium.launch({ channel: "msedge" });

const tris = {};
const page = await browser.newPage({ viewport: { width: 640, height: 768 } });
page.on("console", (msg) => {
  const m = msg.text().match(/\[psxcc\] (acc_\w+): (\d+) tris/);
  if (m) tris[m[1]] = Number(m[2]);
});

for (const [slot, ids] of Object.entries(SLOT_ITEMS)) {
  for (const id of ids) {
    for (const [view, yaw] of Object.entries(views)) {
      await page.setViewportSize({ width: 640, height: 768 });
      await page.goto(
        `http://localhost:5199?hair=hair_01&${slot}=${id}&c=%23111d44`
      );
      await page.waitForTimeout(350);
      await page.evaluate((y) => {
        if (window.PSXCC) {
          PSXCC.setAuto(false);
          PSXCC.controls.yaw = y;
        }
      }, yaw);
      await page.waitForTimeout(150);
      await page.screenshot({ path: `shots/m5_${id}_${view}.png` });
    }
  }
}

// full page + accessories panel, both sizes
for (const [w, h, name] of [[1024, 768, "desktop.png"], [390, 844, "mobile.png"]]) {
  await page.setViewportSize({ width: w, height: h });
  await page.goto("http://localhost:5199?cat=accessories&bag=acc_shoulder_bag");
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    if (window.PSXCC) {
      PSXCC.setAuto(false);
      PSXCC.controls.yaw = 0;
    }
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `shots/${name}` });
}
await page.close();
await browser.close();
await server.close();
writeFileSync("shots/m5-tris.json", JSON.stringify(tris, null, 1));
console.log("M5 acc shots saved to /shots", tris);
