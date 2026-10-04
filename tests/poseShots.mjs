import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { createServer } from "vite";

// M6.5 pose verification shots:
//  - pose panel (desktop + mobile), 9 presets (desktop), 3 custom poses
//  - ?debug=poses cycle: 4 representative outfits x 9 presets
mkdirSync("shots", { recursive: true });

const server = await createServer({ server: { port: 5199 } });
await server.listen();

const browser = await chromium.launch({ channel: "msedge" });
const settle = (page) => page.evaluate(() => {
  if (window.PSXCC) {
    if (PSXCC.setAuto) PSXCC.setAuto(false);
    PSXCC.controls.yaw = 0.35;
    if (PSXCC.pose?.debugAuto) PSXCC.pose.debugAuto(false);
  }
});

// ---- desktop: panel + presets + customs ------------------------------------
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
await page.goto("http://localhost:5199/?cat=pose");
await page.waitForTimeout(600);
await settle(page);
await page.waitForTimeout(200);
await page.screenshot({ path: "shots/pose_panel_desktop.png" });

const ids = await page.evaluate(() => PSXCC.pose.list());
for (let i = 0; i < ids.length; i++) {
  await page.evaluate((id) => PSXCC.pose.preset(id), ids[i]);
  await page.waitForTimeout(500); // stepped 0.25 s interpolation finished
  await page.screenshot({
    path: `shots/pose_${String(i).padStart(2, "0")}_${ids[i]}.png`,
  });
}

// 3 custom poses: extreme arm raise / wide stance with skirt / tilt+twist
await page.evaluate(() => {
  PSXCC.state.bottom = { id: "bot_long_skirt", colors: { main: "#3a5ca8" } };
  PSXCC.applyAll();
  PSXCC.pose.custom({
    armL: { raise: 170, forward: 6, elbow: 10 },
    armR: { raise: 170, forward: 6, elbow: 10 },
  });
});
await page.waitForTimeout(300);
await page.screenshot({ path: "shots/pose_custom1_raise.png" });

await page.evaluate(() => {
  PSXCC.state.bottom = { id: "bot_long_skirt", colors: { main: "#3a5ca8" } };
  PSXCC.applyAll();
  PSXCC.pose.custom({ legL: { spread: 35 }, legR: { spread: 35 } });
});
await page.waitForTimeout(300);
await page.screenshot({ path: "shots/pose_custom2_stance.png" });

await page.evaluate(() => {
  PSXCC.state.bottom = { id: "bot_long_pants", colors: { main: "#3a5ca8" } };
  PSXCC.applyAll();
  PSXCC.pose.custom({
    tilt: 25, waistTwist: 35, headTurn: 40,
    armL: { raise: 45, forward: 10, elbow: 60 },
  });
});
await page.waitForTimeout(300);
await page.screenshot({ path: "shots/pose_custom3_twist.png" });
await page.close();

// ---- mobile portrait: default + sit + panel --------------------------------
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } });
await mob.goto("http://localhost:5199/?cat=pose&pose=pose_default");
await mob.waitForTimeout(600);
await settle(mob);
await mob.waitForTimeout(200);
await mob.screenshot({ path: "shots/pose_mobile_default.png" });
await mob.evaluate(() => PSXCC.pose.preset("pose_sit"));
await mob.waitForTimeout(500);
await mob.screenshot({ path: "shots/pose_mobile_sit.png" });
await mob.close();

// ---- ?debug=poses cycle: outfits x presets ---------------------------------
const dbg = await browser.newPage({ viewport: { width: 1024, height: 768 } });
await dbg.goto("http://localhost:5199/?debug=poses");
await dbg.waitForTimeout(600);
await settle(dbg);
const total = await dbg.evaluate(() => PSXCC.pose.debugIndex().total);
const rounds = 4 * total;
for (let i = 0; i < rounds; i++) {
  await dbg.screenshot({ path: `shots/posedbg_${String(i).padStart(2, "0")}.png` });
  await dbg.evaluate(() => PSXCC.pose.debugNext());
  await dbg.waitForTimeout(250);
}
await dbg.close();

await browser.close();
await server.close();
console.log("pose shots saved to /shots");
