// M9 print test — "OBJ for 3D printing" contract on the default character:
//   mm units / Y-up / feet at y=0 / optional 3mm base disc, height window
//   ±0.5 mm, clean topology report (no open edges / non-manifold / flipped
//   shells), colour column on/off, headless pose warnings, determinism.
// Run: node tests/m9Print.mjs
import { chromium } from "playwright";
import { createServer } from "vite";

const PORT = 5195;
const server = await createServer({ server: { port: PORT } });
await server.listen();

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${detail}`); }
}

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 720, height: 640 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`http://localhost:${PORT}/`);
await page.waitForTimeout(900);
await page.evaluate(() => {
  if (window.PSXCC) { PSXCC.setAuto(false); PSXCC.controls.yaw = 0; }
});
await page.waitForTimeout(300);

// parse a print OBJ into { v, f, coloured, bbox, sizes } for assertions
const scan = (text) => {
  const lines = text.split("\n");
  let x0 = 1e9, y0 = 1e9, z0 = 1e9, x1 = -1e9, y1 = -1e9, z1 = -1e9;
  let v = 0, f = 0, coloured = 0;
  const sizes = new Set();
  for (const l of lines) {
    const t = l.split(" ");
    if (t[0] === "v") {
      v++;
      const a = t.slice(1).map(Number);
      if (t.length > 4) coloured++;
      x0 = Math.min(x0, a[0]); x1 = Math.max(x1, a[0]);
      y0 = Math.min(y0, a[1]); y1 = Math.max(y1, a[1]);
      z0 = Math.min(z0, a[2]); z1 = Math.max(z1, a[2]);
      sizes.add(t.length - 1);
    } else if (t[0] === "f") f++;
  }
  return { v, f, coloured, shape: sizes, bbox: [x0, y0, z0, x1, y1, z1] };
};

// ---- 1. default settings: 80mm, coloured, base + feet ---------------------------
const r1 = await page.evaluate(async () => {
  const r = await PSXCC.exports.printOBJ({});
  return { text: r.text, filename: r.filename, stats: r.stats,
    report: r.report, warnings: r.warnings, minWallMm: r.minWallMm };
});
const g1 = scan(r1.text);
check("filename pattern", /^psx-character-.+-print-80mm-\d{8}-\d{4}\.obj$/.test(r1.filename),
  r1.filename);
check("header states mm/Y-up/feet y=0",
  r1.text.includes("units: mm - Y up - origin at the base centre - feet plane at y=0"));
check("one object (merged mesh)", /^o psx-character-print$/m.test(r1.text));
check("has vertices, faces closed 1:3", g1.v > 0 && g1.f === g1.v / 3,
  `v ${g1.v} f ${g1.f}`);
check("all v lines coloured (6 tokens)",
  g1.shape.size === 1 && g1.shape.has(6), [...g1.shape].join(","));
check("colours in 0..1", r1.text.split("\n").every((l) => {
  if (!l.startsWith("v ")) return true;
  return l.split(" ").slice(4, 7).every((c) => Number.isFinite(+c) && +c >= 0 && +c <= 1);
}));
check("NaN-clean text", !/\bnan\b|\binfinity\b/i.test(r1.text));
check("height window ±0.5mm",
  g1.bbox[4] > 79.5 && g1.bbox[4] < 80.5, `y max ${g1.bbox[4]}`);
check("feet plane at y=0 (body above 0)", g1.bbox[1] > -3.2 && g1.bbox[1] <= 0,
  `y min ${g1.bbox[1]}`);
check("base disc bottom -3mm", g1.bbox[1] > -3.15 && g1.bbox[1] < -2.85,
  `y min ${g1.bbox[1]}`);
check("origin at base centre (x/z symmetric-ish)",
  Math.abs((g1.bbox[0] + g1.bbox[3]) / 2) < 1, `x mid ${(g1.bbox[0] + g1.bbox[3]) / 2}`);
check("report: open edges 0", r1.report.openEdges === 0, String(r1.report.openEdges));
check("report: non-manifold <= 2", r1.report.nonManifoldEdges <= 2,
  String(r1.report.nonManifoldEdges));
check("report: flipped shells 0", r1.report.flippedShells === 0);
check("report: winding 1", r1.report.winding === 1, String(r1.report.winding));
check("report: shells >= 1, tris sane", r1.report.shells >= 1 && r1.report.triCount > 0);
check("report: bbox finite",
  Number.isFinite(r1.report.bbox.y0) && Number.isFinite(r1.report.bbox.z1));
check("min wall >= 0.7mm", r1.minWallMm >= 0.7, String(r1.minWallMm));
check("no pose warnings at rest", r1.warnings.length === 0, r1.warnings.join("; "));

// ---- 2. 50mm variant ------------------------------------------------------------
const r2 = await page.evaluate(async () => {
  const r = await PSXCC.exports.printOBJ({ heightMm: 50 });
  return { text: r.text, filename: r.filename, report: r.report };
});
const g2 = scan(r2.text);
check("50mm height window", g2.bbox[4] > 49.5 && g2.bbox[4] < 50.5, `y max ${g2.bbox[4]}`);
check("50mm base intact", g2.bbox[1] > -3.15 && g2.bbox[1] < -2.85);
check("50mm topology still clean",
  r2.report.openEdges === 0 && r2.report.flippedShells === 0);
check("50mm filename intros height", /-print-50mm-/.test(r2.filename), r2.filename);

// ---- 3. 150mm, single colour, no base, no feet bridge ---------------------------
const r3 = await page.evaluate(async () => {
  const r = await PSXCC.exports.printOBJ({
    heightMm: 150, coloured: false, base: false, connectFeet: false,
  });
  return { text: r.text, report: r.report, stats: r.stats };
});
const g3 = scan(r3.text);
check("150mm height window", g3.bbox[4] > 149.5 && g3.bbox[4] < 150.5, `y max ${g3.bbox[4]}`);
check("no disc/bridge: stand on y=0", g3.bbox[1] >= -0.06, `y min ${g3.bbox[1]}`);
check("single colour: no colour columns",
  g3.shape.size === 1 && g3.shape.has(3) && g3.coloured === 0,
  [...g3.shape].join(","));
check("single colour is cheaper (no lattice)",
  g3.f < g1.f, `${g3.f} vs ${g1.f}`);
check("header says single colour", r3.text.includes("single colour"));

// ---- 4. thickness 2.0 → min wall follows ----------------------------------------
const r4 = await page.evaluate(async () => {
  const r = await PSXCC.exports.printOBJ({ thicknessMm: 2.0 });
  return { minWallMm: r.minWallMm };
});
check("2.0mm wall window", r4.minWallMm >= 1.9, String(r4.minWallMm));

// ---- 5. pose warnings -----------------------------------------------------------
const r5 = await page.evaluate(async () => {
  PSXCC.pose.custom({ armL: { raise: 150 } });
  const a = await PSXCC.exports.printOBJ({});
  PSXCC.pose.custom({ tilt: 25 });
  const b = await PSXCC.exports.printOBJ({});
  PSXCC.pose.preset("pose_default");
  return {
    armT: a.warnings, tiltT: b.warnings,
    open: [a.report.openEdges, b.report.openEdges],
    flip: [a.report.flippedShells, b.report.flippedShells],
  };
});
check("raised arm warning", r5.armT.some((w) => /RAISED ARM/.test(w)), r5.armT.join("; "));
check("body tilt warning", r5.tiltT.some((w) => /BODY TILT/.test(w)), r5.tiltT.join("; "));
check("warned prints still seal", r5.open[0] === 0 && r5.open[1] === 0
  && r5.flip[0] === 0 && r5.flip[1] === 0,
  `open ${r5.open} flip ${r5.flip}`);

// ---- 6. determinism -------------------------------------------------------------
const dets = await page.evaluate(async () =>
  [await (await PSXCC.exports.printOBJ({})).text,
    await (await PSXCC.exports.printOBJ({})).text]);
check("identical input -> identical output", dets[0] === dets[1]);

console.log(`\n${pass} passed, ${fail} failed`);
console.log("page errors:", errors.length ? errors : "none");
await browser.close();
await server.close();
process.exit(fail || errors.length ? 1 : 0);
