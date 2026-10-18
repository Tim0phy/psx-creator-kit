// M9 six-character sweep — every representative character must produce a
// valid display zip AND a seal-clean 80mm coloured print with height inside
// ±0.5 mm. Characters:
//   1 default                 2 long hair + cat ears
//   3 plaid pleated skirt     4 wide cargo + cap
//   5 custom pose: raised arm  6 custom pose: tilt + waist twist
// Run: node tests/m9Characters.mjs
import { chromium } from "playwright";
import { createServer } from "vite";
import { unzipSync, strFromU8 } from "fflate";

const PORT = 5194;
const server = await createServer({ server: { port: PORT } });
await server.listen();

let pass = 0, fail = 0;
function check(name, cond, detail = "") {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${detail}`); }
}

const CHARS = [
  { label: "default", url: "", pose: null, warn: null },
  { label: "hair02+ears", url: "?hair=hair_02&headwear=acc_cat_ears",
    pose: null, warn: null },
  { label: "plaid pleated", url: "?bottom=bot_plaid_pleated", pose: null, warn: null },
  { label: "cargo+cap", url: "?bottom=bot_cargo_wide&headwear=acc_cap",
    pose: null, warn: null },
  { label: "raised arm", url: "", pose: { armL: { raise: 150 } }, warn: "RAISED ARM" },
  { label: "tilt+twist", url: "", pose: { tilt: 25, waistTwist: 35 }, warn: "BODY TILT" },
];

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 720, height: 640 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

for (const c of CHARS) {
  console.log(`\n# ${c.label} ${c.url}`);
  await page.goto(`http://localhost:${PORT}/${c.url}`);
  await page.waitForTimeout(800);
  await page.evaluate(() => {
    if (window.PSXCC) { PSXCC.setAuto(false); PSXCC.controls.yaw = 0; }
  });
  if (c.pose) await page.evaluate((p) => PSXCC.pose.custom(p), c.pose);
  await page.waitForTimeout(300);

  const r = await page.evaluate(async () => {
    const d = await PSXCC.exports.displayOBJ();
    const p = await PSXCC.exports.printOBJ({ heightMm: 80 });
    return {
      zip: Array.from(d.bytes), dstats: d.stats,
      ptext: p.text, preport: p.report, pwarn: p.warnings,
    };
  });

  // --- display zip ------------------------------------------------------------
  const zip = unzipSync(new Uint8Array(r.zip));
  const members = Object.keys(zip);
  check("zip members complete", zip["character.obj"] && zip["character.mtl"]
    && zip["face.png"], members.join(","));
  const objText = strFromU8(zip["character.obj"]);
  const mtlText = strFromU8(zip["character.mtl"]);
  check("obj NaN-free",
    !/\bnan\b|\binfinity\b/i.test(strFromU8(zip["character.obj"])));
  check("all v lines carry colour",
    objText.split("\n").filter((l) => /^v /.test(l))
      .every((l) => l.trim().split(/ +/).length === 7));
  check("MTL maps resolve", (mtlText.match(/^map_Kd -clamp on (\S+)$/gm) ?? [])
    .every((l) => zip[l.split(" ").pop()] !== undefined));
  check("no face-decal object", !/^o face$/m.test(objText));

  // --- print -------------------------------------------------------------------
  const scan = { v: 0, f: 0, y0: 1e9, y1: -1e9, shape: new Set() };
  for (const l of r.ptext.split("\n")) {
    const t = l.split(" ");
    if (t[0] === "v") {
      scan.v++;
      scan.y0 = Math.min(scan.y0, +t[2]); scan.y1 = Math.max(scan.y1, +t[2]);
      scan.shape.add(t.length - 1);
    } else if (t[0] === "f") scan.f++;
  }
  check("print open edges 0", r.preport.openEdges === 0, String(r.preport.openEdges));
  check("print non-manifold <= 2", r.preport.nonManifoldEdges <= 2,
    String(r.preport.nonManifoldEdges));
  check("print flipped shells 0", r.preport.flippedShells === 0,
    String(r.preport.flippedShells));
  check("print height 80±0.5", scan.y1 > 79.5 && scan.y1 < 80.5, `y max ${scan.y1}`);
  check("feet above disc bottom", scan.y0 > -3.2 && scan.y0 <= 0, `y min ${scan.y0}`);
  check("print tri budget sane", scan.f <= 30000, `${scan.f} tris`);
  check("print v/f 1:3", scan.f === scan.v / 3, `v ${scan.v} f ${scan.f}`);
  check("print colour columns uniform", scan.shape.size === 1,
    [...scan.shape].join(","));
  check("pose warning present", !c.warn || r.pwarn.some((w) => w.includes(c.warn)),
    r.pwarn.join("; "));
}

console.log(`\n${pass} passed, ${fail} failed`);
console.log("page errors:", errors.length ? errors : "none");
await browser.close();
await server.close();
process.exit(fail || errors.length ? 1 : 0);
