import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { createServer } from "vite";

// Mobile layout regression: the portrait style sheet must split the free height
// 50:50 with the 3D preview, the auto-rotation button must be reachable, and
// every top-bar control must actually receive taps on coarse-pointer devices
// (a bad hit-pocket anchor used to make the whole bar belong to one button).

mkdirSync("shots", { recursive: true });

const server = await createServer({
  server: { port: 5199 },
  customLogger: { info: () => {}, warn: () => {}, error: (m) => console.error(String(m)) },
});
await server.listen();

const browser = await chromium.launch({ channel: "msedge" });
const URL = "http://localhost:5199";
const sleep = (t) => new Promise((r) => setTimeout(r, t));
let failed = 0;
const results = [];
const pageErrs = [];

function check(name, ok, extra = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  | " + extra : ""}`);
  if (!ok) failed++;
}

async function newPage(w, h, opts = {}) {
  const page = await browser.newPage({ viewport: { width: w, height: h }, ...opts });
  page.on("pageerror", (e) => pageErrs.push(String(e)));
  return page;
}

const rect = (page, sel) => page.evaluate((s) => {
  const b = document.querySelector(s).getBoundingClientRect();
  return { x: b.x, y: b.y, w: b.width, h: b.height, bottom: b.bottom };
}, sel);

// ---- portrait phones --------------------------------------------------------
// 390/360 are tall enough for an exact 50:50 split; 320x568 is short, so the
// sheet keeps a usable floor and both panes stay comfortably visible.
for (const [w, h, label, exactSplit] of [
  [390, 844, "390x844", true],
  [360, 740, "360x740", true],
  [320, 568, "320x568", false],
]) {
  const page = await newPage(w, h, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await page.goto(URL);
  await sleep(650);
  await page.evaluate(() => PSXCC.setAuto(false));

  check(`${label}: coarse pointer`, await page.evaluate(() => matchMedia("(pointer: coarse)").matches));

  // every top-bar control owns its own pixel (hit-testing)
  const hits = await page.evaluate(() => {
    const at = (id) => {
      const b = document.getElementById(id).getBoundingClientRect();
      const el = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2);
      return el ? el.id || el.tagName : "none";
    };
    return {
      name: at("nameInput"), random: at("btnRandom"), reset: at("btnReset"),
      camera: at("btnCamera"), rotate: at("btnRotate"),
    };
  });
  check(`${label}: hit targets`, hits.name === "nameInput" && hits.random === "btnRandom"
    && hits.reset === "btnReset" && hits.camera === "btnCamera" && hits.rotate === "btnRotate",
    JSON.stringify(hits));

  const rot = await rect(page, "#btnRotate");
  check(`${label}: auto-rotation visible`, rot.w > 0 && rot.h > 0, `${rot.w}x${rot.h}`);

  const stage = await rect(page, "#stage");
  const sheet = await rect(page, "#sheet");
  const bar = await rect(page, "#categoryBar");
  const ratio = stage.h / sheet.h;
  if (exactSplit) {
    check(`${label}: preview : sheet 50:50`, Math.abs(ratio - 1) <= 0.05,
      `stage ${Math.round(stage.h)} : sheet ${Math.round(sheet.h)} (${ratio.toFixed(2)})`);
  } else {
    // short screen: the sheet keeps a usable floor, so the preview gives up a
    // little; both stay comfortably visible and the panel is not clipped.
    check(`${label}: sheet keeps usable floor`, sheet.h >= 200, `sheet ${Math.round(sheet.h)}`);
    check(`${label}: preview keeps usable height`, stage.h >= 140, `stage ${Math.round(stage.h)}`);
  }
  check(`${label}: sheet below preview`, sheet.y - stage.bottom > 0,
    `gap ${Math.round(sheet.y - stage.bottom)}`);
  check(`${label}: sheet clear of category bar`, bar.y - sheet.bottom > 0,
    `gap ${Math.round(bar.y - sheet.bottom)}`);

  // real taps hit the right handlers
  await page.evaluate(() => {
    window.__p = { random: 0, reset: 0, dice: 0, rotate: 0, camera: 0 };
    const hit = (id) => document.getElementById(id)
      .addEventListener("click", () => window.__p[id.replace("btn", "").toLowerCase()]++);
    ["btnRandom", "btnReset", "btnDice", "btnRotate"].forEach(hit);
    document.getElementById("btnCamera").addEventListener("click", () => window.__p.camera++);
  });
  for (const id of ["btnRandom", "btnReset", "btnDice", "btnRotate"]) {
    const b = await rect(page, `#${id}`);
    await page.touchscreen.tap(b.x + b.w / 2, b.y + b.h / 2);
    await sleep(120);
  }
  const taps = await page.evaluate(() => window.__p);
  check(`${label}: taps fire correct controls`,
    taps.random === 1 && taps.reset === 1 && taps.dice === 1 && taps.rotate === 1 && taps.camera === 0,
    JSON.stringify(taps));

  // category switching still works with the full-width bar
  const before = await page.evaluate(() => document.querySelector(".catBtn.active")?.dataset.cat);
  const eye = await rect(page, '.catBtn[data-cat="top"]');
  await page.touchscreen.tap(eye.x + eye.w / 2, eye.y + eye.h / 2);
  await sleep(350);
  const after = await page.evaluate(() => document.querySelector(".catBtn.active")?.dataset.cat);
  check(`${label}: category switch`, after === "top" && after !== before, `${before} -> ${after}`);

  // pose tab: the slider column must fit the narrow right column
  const poseBtn = await rect(page, '.catBtn[data-cat="pose"]');
  await page.touchscreen.tap(poseBtn.x + poseBtn.w / 2, poseBtn.y + poseBtn.h / 2);
  await sleep(350);
  const fit = await page.evaluate(() => {
    const rp = document.getElementById("rightPanel");
    const sheet = document.getElementById("sheet").getBoundingClientRect();
    const pill = document.querySelector("#rightBody .rightPill");
    return {
      xOverflow: rp.scrollWidth - rp.clientWidth,
      pillOverSheet: pill ? pill.getBoundingClientRect().right - sheet.right : 0,
    };
  });
  check(`${label}: pose controls fit column`, fit.xOverflow <= 2, `x-overflow ${fit.xOverflow}px`);
  check(`${label}: right pill fits sheet`, fit.pillOverSheet <= 2,
    `pill ${Math.round(fit.pillOverSheet)}px past sheet`);

  await page.screenshot({ path: `shots/mobile_${label}.png` });
  await page.close();
}

// ---- compact landscape ------------------------------------------------------
{
  const page = await newPage(740, 360, { hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await page.goto(URL);
  await sleep(600);
  await page.evaluate(() => PSXCC.setAuto(false));
  const bar = await rect(page, "#categoryBar");
  const stage = await rect(page, "#stage");
  check("landscape: category bar one row", bar.h <= 80, `h ${Math.round(bar.h)}`);
  check("landscape: stage clear of category bar", bar.y - stage.bottom >= 0,
    `gap ${Math.round(bar.y - stage.bottom)}`);
  await page.screenshot({ path: "shots/mobile_landscape.png" });
  await page.close();
}

// ---- desktop unchanged ------------------------------------------------------
{
  const page = await newPage(1024, 768);
  await page.goto(URL);
  await sleep(600);
  const hits = await page.evaluate(() => {
    const at = (id) => {
      const b = document.getElementById(id).getBoundingClientRect();
      return document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2)?.id;
    };
    return { name: at("nameInput"), random: at("btnRandom"), rotate: at("btnRotate") };
  });
  check("desktop: top-bar hit targets", hits.name === "nameInput"
    && hits.random === "btnRandom" && hits.rotate === "btnRotate", JSON.stringify(hits));
  const sheet = await rect(page, "#sheet");
  check("desktop: sheet not a layout box (absolute children)", sheet.h === 0, `h ${sheet.h}`);
  await page.close();
}

await browser.close();
await server.close();

console.log(results.join("\n"));
console.log(`pageerrors: ${pageErrs.length ? pageErrs.join(" || ") : "none"}`);
console.log(`\n${failed ? failed + " FAILURES" : "ALL PASSED"}`);
process.exit(failed || pageErrs.length ? 1 : 0);
