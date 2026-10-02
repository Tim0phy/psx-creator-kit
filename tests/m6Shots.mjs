import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { createServer } from "vite";

mkdirSync("shots", { recursive: true });

const server = await createServer({ server: { port: 5199 } });
await server.listen();

const browser = await chromium.launch({ channel: "msedge" });

// per-item: front + angle views wearing the item in a bright debug colour
const items = [
  ["top", "top_baby_tee"],
  ["top", "top_knit_vest"],
  ["top", "top_polo"],
  ["top", "top_offshoulder"],
  ["top", "top_jersey_crop"],
  ["top", "top_denim_shirt"],
  ["outer", "outer_blazer"],
  ["outer", "outer_denim_jacket"],
  ["outer", "outer_bomber"],
  ["bottom", "bot_lowrise_jeans"],
  ["bottom", "bot_cargo_wide"],
  ["bottom", "bot_plaid_pleated"],
  ["bottom", "bot_tennis_skirt"],
  ["bottom", "bot_lowrise_mini"],
  ["bottom", "bot_metallic_pants"],
  ["socks", "sock_knee_stripe"],
  ["shoes", "shoe_white_sneaker"],
  ["shoes", "shoe_platform"],
  ["shoes", "shoe_mary_jane"],
  ["shoes", "shoe_knee_boots"],
];

const SLOTS = new Map(items);
const views = { front: 0, angle: 0.6 };

for (const [slot, id] of items) {
  const hide = [];
  if (slot === "socks") { hide.push("bottom"); }
  if (slot === "outer") { hide.push("top"); }
  const q = hide.length ? `&${hide.map((s) => `${s}=none`).join("&")}` : "";
  for (const [view, yaw] of Object.entries(views)) {
    const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
    page.on("pageerror", (e) => console.log(`[err] ${id}: ${e.message}`));
    await page.goto(
      `http://localhost:5199/?${slot}=${id}&c=%23e85a78${q}`
    );
    await page.waitForTimeout(400);
    await page.evaluate(() => {
      if (window.PSXCC) {
        if (PSXCC.setAuto) PSXCC.setAuto(false);
        PSXCC.controls.yaw = 0;
      }
    });
    await page.evaluate((y) => { PSXCC.controls.yaw = y; }, yaw);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `shots/m6_${id}_${view}.png` });
    await page.close();
  }
}

// presets + auto colour-block (fixed hue 210 for determinism)
const presets = [
  "preset_preppy", "preset_street", "preset_denim",
  "preset_sport", "preset_y2k", "preset_colorblock",
];
for (const p of presets) {
  for (const [w, h, name] of [[1024, 768, "desktop.png"], [390, 844, "mobile.png"]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    page.on("pageerror", (e) => console.log(`[err] ${p}: ${e.message}`));
    // fixed hue only for the auto colour-block preset -> deterministic shots
    const hueQ = p === "preset_colorblock" ? "&hue=210" : "";
    await page.goto(`http://localhost:5199/?cat=style&preset=${p}${hueQ}`);
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      if (window.PSXCC) {
        if (PSXCC.setAuto) PSXCC.setAuto(false);
        PSXCC.controls.yaw = 0;
      }
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `shots/m6_${p}_${name}` });
    await page.close();
  }
}

await browser.close();
await server.close();
console.log("M6 shots saved to /shots");
