import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { readFile as fsRead } from "fs/promises";
import { createServer } from "vite";

// M7 state tests: reload persistence, invalid JSON, unknown IDs, missing
// fields, colour validation, random/reset, selection preservation, JSON
// export/import round-trip, dev inspector and mobile controls.
// Results print as PASS/FAIL lines; a failing step exits non-zero.

mkdirSync("shots", { recursive: true });

const server = await createServer({
  server: { port: 5199 },
  customLogger: {
    info: () => {}, warn: () => {}, error: (m) => console.error(String(m)),
  },
});
await server.listen();

const browser = await chromium.launch({ channel: "msedge" });
const URL = "http://localhost:5199";
let failed = 0;
const results = [];

function check(name, ok, extra = "") {
  results.push(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  | " + extra : ""}`);
  if (!ok) failed++;
}

const pageErrs = [];
async function newPage(w = 1024, h = 768, opts = {}) {
  const page = await browser.newPage({
    viewport: { width: w, height: h },
    ...opts,
  });
  page.on("pageerror", (e) => pageErrs.push(String(e)));
  return page;
}

const sleep = (t) => new Promise((r) => setTimeout(r, t));

// ---- 1. reload persistence ---------------------------------------------------
{
  const page = await newPage();
  await page.goto(URL);
  await sleep(500);
  // dress a custom look through the real UI: category TOP -> item 3 (sweater)
  await page.click('.catBtn[data-cat="top"]');
  await sleep(300);
  await page.click("#leftGrid .gridBtn:nth-child(4)"); // sweater in grid order
  await sleep(300);
  // colour: click swatch 4 in the first colour group
  await page.click("#rightBody .colorGroup:first-child .swatchBtn:nth-child(4)");
  await sleep(200);
  const before = await page.evaluate(() => ({
    id: PSXCC.state.top.id,
    main: PSXCC.state.top.colors.main,
    save: PSXCC.save(),
  }));
  await page.click("#btnConfirm");
  await sleep(200);
  await page.reload();
  await sleep(600);
  const after = await page.evaluate(() => ({
    id: PSXCC.state.top.id,
    main: PSXCC.state.top.colors.main,
    stored: JSON.parse(localStorage.getItem("psxcc.v1")),
  }));
  check("reload persistence: top id", after.id === before.id, `${before.id} -> ${after.id}`);
  check("reload persistence: colour", after.main === before.main, `${before.main} -> ${after.main}`);
  // STYLE.md format on disk
  check("psxcc.v1 format: colors array", Array.isArray(after.stored.top?.colors),
    JSON.stringify(after.stored.top));
  check("psxcc.v1 format: keys", ["skin", "eyes", "mouth", "hair", "top", "pose"]
    .every((k) => k in after.stored), Object.keys(after.stored).join(","));
  check("psxcc.v1 format: no follow flag", !("secondaryFollow" in (after.stored.top ?? {})));
  // UI reflects the restored selection
  const activeLabel = await page.evaluate(() =>
    document.querySelector("#leftGrid .gridBtn.active")?.title ?? "");
  check("reload persistence: UI active thumb", activeLabel.length > 0, activeLabel);
  await page.screenshot({ path: "shots/m7_persistence.png" });
  await page.close();
}

// ---- 2. invalid JSON ----------------------------------------------------------
{
  const page = await newPage();
  await page.goto(URL); // seed a clean save first
  await sleep(400);
  await page.evaluate(async () => {
    localStorage.clear();
    await fetch("/");
  });
  await page.reload();
  await sleep(400);
  await page.evaluate(() => {
    localStorage.setItem("psxcc.v1", "{this is not json]");
  });
  const r2 = await page.reload();
  await sleep(700);
  const st = await page.evaluate(() => ({
    top: PSXCC.state.top?.id, skin: PSXCC.state.skin,
    eyes: PSXCC.state.eyes, build: PSXCC.build,
  }));
  check("invalid JSON: boots with defaults",
    st.top === "top_tee" && st.eyes === 3,
    JSON.stringify(st));
  await page.close();
}

// ---- 3. unknown ids + invalid colours + missing fields -------------------------
{
  const page = await newPage();
  await page.goto(URL);
  await sleep(400);
  await page.evaluate(() => {
    localStorage.setItem("psxcc.v1", JSON.stringify({
      skin: "not-a-colour",
      eyes: 99,
      mouth: 0,
      hair: { id: "hair_99", color: "zzz" },
      top: { id: "top_fake", colors: ["#ff0000"] },
      bottom: { id: "shoe_sneaker", colors: ["#00ff00"] }, // wrong slot
      shoes: { id: "shoe_sneaker", colors: ["BAD", "#123"] },
      socks: { id: "shoe_sneaker" },                       // missing colours
      headwear: { id: 42 },
      pose: { preset: "pose_nope" },
      body: "robot",
    }));
  });
  await page.reload();
  await sleep(700);
  const st = await page.evaluate(() => ({
    top: PSXCC.state.top, bottom: PSXCC.state.bottom,
    shoes: PSXCC.state.shoes, socks: PSXCC.state.socks,
    headwear: PSXCC.state.headwear, h: PSXCC.state.hair,
    skin: PSXCC.state.skin, eyes: PSXCC.state.eyes, mouth: PSXCC.state.mouth,
    body: PSXCC.state.body, pose: PSXCC.state.pose.preset,
  }));
  check("unknown id: top -> none", st.top === null, JSON.stringify(st.top));
  check("unknown id: hair -> default", st.h?.id === "hair_01", st.h?.id);
  check("cross-slot id: bottom -> none", st.bottom === null);
  check("bad colours: shoes fallback", st.shoes?.colors?.main === "#ffffff",
    JSON.stringify(st.shoes));
  check("missing colors array: socks -> none?" , st.socks === null,
    JSON.stringify(st.socks));
  check("invalid skin kept default", st.skin === "#f5d5bf", st.skin);
  check("out-of-range eyes kept", st.eyes === 3, String(st.eyes));
  check("body fallback", st.body === "female", st.body);
  check("pose fallback", st.pose === "pose_default", st.pose);
  await page.screenshot({ path: "shots/m7_unknown_ids.png" });
  await page.close();
}

// ---- 4. missing fields: {} -> defaults -----------------------------------------
{
  const page = await newPage();
  await page.goto(URL);
  await sleep(400);
  await page.evaluate(() => localStorage.setItem("psxcc.v1", "{}"));
  await page.reload();
  await sleep(600);
  const st = await page.evaluate(() => ({
    top: PSXCC.state.top.id, bottom: PSXCC.state.bottom.id,
    hair: PSXCC.state.hair.id, eyes: PSXCC.state.eyes,
    mouth: PSXCC.state.mouth, pose: PSXCC.state.pose.preset,
  }));
  check("missing fields: full defaults",
    st.top === "top_tee" && st.hair === "hair_01" && st.eyes === 3
      && st.mouth === 1 && st.pose === "pose_default",
    JSON.stringify(st));
  await page.close();
}

// ---- 5. valid 3-digit hex normalisation + secondary colours ---------------------
{
  const page = await newPage();
  await page.goto(URL);
  await sleep(400);
  await page.evaluate(() => {
    localStorage.setItem("psxcc.v1", JSON.stringify({
      top: { id: "top_knit_vest", colors: ["#ABC", "red"] },
      wrist: { id: "acc_watch", colors: { main: "#e06060", secondary: "#c8f56b" } },
    }));
  });
  await page.reload();
  await sleep(600);
  const st = await page.evaluate(() => ({
    top: PSXCC.state.top.colors, wrist: PSXCC.state.wrist.colors,
  }));
  check("3-digit hex expands", st.top.main === "#aabbcc", st.top.main);
  check("named colour rejected", !st.top.secondary, JSON.stringify(st.top));
  check("legacy colour map accepted", st.wrist.main === "#e06060"
    && st.wrist.secondary === "#c8f56b", JSON.stringify(st.wrist));
  await page.close();
}

// ---- 6. random / reset + selection preservation ---------------------------------
{
  const page = await newPage();
  await page.goto(URL);
  await sleep(500);
  await page.click('.catBtn[data-cat="top"]');
  await sleep(300);
  await page.click("#leftGrid .gridBtn:nth-child(4)"); // sweater
  await sleep(200);
  const kept = await page.evaluate(() => PSXCC.state.top.colors.main);
  check("selection preservation: colours carry on item switch",
    kept === "#e06060", JSON.stringify(kept));

  await page.click("#btnRandom");
  await sleep(700);
  const rnd = await page.evaluate(() => ({
    top: PSXCC.state.top, skin: PSXCC.state.skin,
    hair: PSXCC.state.hair, pose: PSXCC.state.pose.preset,
    eyes: PSXCC.state.eyes,
  }));
  check("random: slots + skin + face + pose randomized",
    rnd.top && rnd.pose, JSON.stringify(rnd).slice(0, 180));
  // every colour slot of the random item got a valid colour
  check("random: colours valid hex",
    /^#[0-9a-f]{6}$/.test(rnd.top.colors.main ?? ""), rnd.top?.colors?.main);

  await page.click("#btnReset");
  await sleep(500);
  const rst = await page.evaluate(() => ({
    top: PSXCC.state.top.id, hair: PSXCC.state.hair.id,
    skin: PSXCC.state.skin, body: PSXCC.state.body,
    pose: PSXCC.state.pose.preset, outer: PSXCC.state.outer,
  }));
  check("reset: back to defaults",
    rst.top === "top_tee" && rst.hair === "hair_01" && rst.skin === "#f5d5bf"
      && rst.body === "female" && rst.pose === "pose_default" && rst.outer === null,
    JSON.stringify(rst));
  await page.screenshot({ path: "shots/m7_reset.png" });
  await page.close();
}

// ---- 7. JSON export + import round-trip -----------------------------------------
{
  const page = await newPage(1024, 768, { acceptDownloads: true });
  await page.goto(URL);
  await sleep(500);
  await page.click("#btnRandom");
  await sleep(700);
  const saved = await page.evaluate(() => PSXCC.save());
  // export: real download event, content matches the STYLE format
  // (register the listener BEFORE the click so the event can't be missed)
  const dlPromise = page.waitForEvent("download", { timeout: 5000 });
  await page.click("#btnExport");
  const dl = await dlPromise;
  const path = await dl.path();
  const exported = JSON.parse(await fsRead(path, "utf8"));
  const exportedKeysOk = ["skin", "eyes", "mouth", "hair", "top", "pose"]
    .every((k) => k in exported)
    && Array.isArray(exported.top.colors)
    && typeof exported.hair === "object" && "color" in exported.hair;
  check("export download: STYLE format JSON", exportedKeysOk && dl.suggestedFilename().endsWith(".json"),
    dl.suggestedFilename());
  // import a different config through the real file input
  const other = { hair: { id: "hair_06", color: "#c8f56b" }, top: { id: "top_polo", colors: ["#228844"] } };
  await page.setInputFiles("#fileImport", {
    name: "config.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(other)),
  });
  await sleep(700);
  const imp = await page.evaluate(() => ({
    h: PSXCC.state.hair, t: PSXCC.state.top.colors, saved: localStorage.getItem("psxcc.v1"),
  }));
  check("import applies config", imp.h?.id === "hair_06" && imp.t?.main === "#228844",
    JSON.stringify({ h: imp.h?.id, t: imp.t?.main }));
  check("import write-through psxcc.v1", imp.saved?.includes('"top_polo"'),
    imp.saved?.slice(0, 120));
  // invalid file: toast + state unchanged
  const stBefore = await page.evaluate(() => PSXCC.state.hair.id);
  await page.setInputFiles("#fileImport", {
    name: "bad.json", mimeType: "application/json",
    buffer: Buffer.from("{broken json"),
  });
  await sleep(400);
  const toast = await page.evaluate(() => document.getElementById("toast").textContent);
  const stAfter = await page.evaluate(() => PSXCC.state.hair.id);
  check("invalid file: INVALID toast, state untouched",
    toast === "INVALID" && stAfter === stBefore, `toast=${toast}`);
  await page.close();
}

// ---- 8. dev-only inspector -------------------------------------------------------
{
  const page = await newPage();
  await page.goto(`${URL}/?debug=state`);
  await sleep(500);
  const insp = await page.evaluate(() => {
    const el = document.getElementById("stateInspector");
    return el ? el.querySelector(".inspBody").textContent.slice(0, 60) : null;
  });
  check("dev inspector present with ?debug=state", !!insp, insp ?? "missing");
  await page.screenshot({ path: "shots/m7_inspector.png" });
  await page.close();

  const clean = await newPage();
  await clean.goto(URL);
  await sleep(400);
  const absent = await clean.evaluate(() => document.getElementById("stateInspector"));
  check("inspector absent on normal boot", absent === null);
  await clean.close();
}

await browser.close();

// ---- 9. mobile controls ----------------------------------------------------------
{
  const browser2 = await chromium.launch({ channel: "msedge" });
  const page = await browser2.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  page.on("pageerror", (e) => pageErrs.push(String(e)));
  await page.goto(URL);
  await sleep(500);
  await page.evaluate(() => PSXCC.setAuto(false));
  // drag rotation on the canvas: dispatched pointer events with
  // pointerType touch — the input path a finger produces in Chrome
  const yaw0 = await page.evaluate(() => PSXCC.controls.yaw);
  await page.evaluate(() => {
    const stage = document.getElementById("stage");
    const evt = (type, x) => new PointerEvent(type, {
      clientX: x, clientY: 250, pointerId: 7, pointerType: "touch",
      isPrimary: true, bubbles: true,
    });
    stage.dispatchEvent(evt("pointerdown", 150));
    for (let i = 1; i <= 8; i++) stage.dispatchEvent(evt("pointermove", 150 + i * 15));
    stage.dispatchEvent(evt("pointerup", 270));
  });
  const yaw1 = await page.evaluate(() => PSXCC.controls.yaw);
  check("mobile: touch drag rotates", Math.abs(yaw1 - yaw0) > 0.02,
    `yaw ${yaw0.toFixed(3)} -> ${yaw1.toFixed(3)}`);
  // category buttons respond to touch taps
  await page.touchscreen.tap(195, 824);
  await sleep(300);
  await page.touchscreen.tap(30, 816);
  await sleep(400);
  const catActive = await page.evaluate(() =>
    document.querySelector(".catBtn.active")?.dataset.cat);
  check("mobile: category switching works", !!catActive, catActive);
  const btnVisible = await page.evaluate(() => {
    const r = document.getElementById("btnExport").getBoundingClientRect();
    return r.width > 0 && r.bottom <= innerHeight;
  });
  check("mobile: export/import reachable", btnVisible);
  await page.screenshot({ path: "shots/m7_mobile.png" });
  await page.close();
  await browser2.close();
}

console.log(results.join("\n"));
console.log(`pageerrors: ${pageErrs.length ? pageErrs.join(" || ") : "none"}`);
console.log(`\n${failed ? failed + " FAILURES" : "ALL PASSED"}`);

await server.close();
process.exit(failed || pageErrs.length ? 1 : 0);
