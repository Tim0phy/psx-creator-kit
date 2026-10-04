import { chromium } from "playwright";
import { createServer } from "vite";

// One-off: print the shin mesh's per-row x extents to confirm which end
// (ankle vs knee) is wide. Also print the shoe cavity pieces' foot-local
// spans vs the shin's bottom row, to see what survives inside the sole.

const server = await createServer({ server: { port: 5211 } });
await server.listen();
const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
await page.goto("http://localhost:5211", { waitUntil: "load" });
await page.waitForTimeout(700);

await page.evaluate(() => {
  PSXCC.setAuto(false);
  PSXCC.controls.yaw = 0;
  const s = PSXCC.state;
  s.hair = null;
  s.body = "male";
  s.top = { id: "top_tee", colors: { main: "#e06060" } };
  s.bottom = { id: "bot_long_pants", colors: { main: "#3a5ca8" } };
  s.shoes = { id: "shoe_sneaker", colors: { main: "#e8913a" } };
  s.outer = s.socks = s.headwear = s.eyewear = s.neck = s.wrist = s.bag = null;
  PSXCC.applyAll();
});
await page.evaluate(() => PSXCC.pose.preset("pose_default"));
await page.waitForTimeout(150);

const out = await page.evaluate(() => {
  const scene = PSXCC.scene;
  const mproto = Object.getPrototypeOf(scene.matrixWorld).constructor;
  const inv = new mproto();
  const V = new (Object.getPrototypeOf(scene.position).constructor)();
  // find shin meshes (skin color, geometry height 0.28)
  const shins = [];
  const shoes = [];
  scene.traverse((m) => {
    if (!m.isMesh) return;
    m.geometry.computeBoundingBox();
    const b = m.geometry.boundingBox;
    const c = m.material?.uniforms?.color?.value;
    const hex = c ? c.getHexString() : "";
    const h = b.max.y - b.min.y;
    if (hex === "f5d5bf" && (Math.abs(h - 0.28) < 0.01 || Math.abs(h - 0.24) < 0.01)) shins.push(m);
    if (hex === "e8913a") shoes.push(m);
  });
  const report = [];
  for (const s of shins) {
    // local rows: group vertices by geometry-local y bands
    const rows = {};
    const pa = s.geometry.attributes.position;
    for (let i = 0; i < pa.count; i++) {
      const y = pa.getY(i);
      const key = y.toFixed(2);
      const x = Math.abs(pa.getX(i));
      (rows[key] ||= []).push(x);
    }
    for (const [k, xs] of Object.entries(rows)) {
      report.push({ row: k, halfX: +Math.max(...xs).toFixed(3),
                    parentJoint: s.parent.name });
    }
  }
  // shoe pieces in foot-local coords: their parent is the foot wrap? print
  // the pieces' world AABB y spans at rest
  const shoeRows = shoes.map((m) => {
    const b = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
    const c = m.geometry.boundingBox;
    return { size: [+(c.max.x - c.min.x).toFixed(2), +(c.max.y - c.min.y).toFixed(2), +(c.max.z - c.min.z).toFixed(2)],
             worldY: [+b.min.y.toFixed(3), +b.max.y.toFixed(3)] };
  });
  const J = PSXCC.character.joints;
  const foot = new (Object.getPrototypeOf(scene.position).constructor)();
  J.footR.getWorldPosition(foot);
  return { report, shoeRows, footY: +foot.y.toFixed(3) };
});

console.log("shin rows (geometry-local y band -> half-width):");
for (const r of out.report) console.log(`  y=${r.row} halfX=${r.halfX} (${r.parentJoint})`);
console.log(`foot joint world y = ${out.footY}`);
console.log("shoe piece world Y spans:");
for (const r of out.shoeRows) console.log(`  size[${r.size}] y[${r.worldY[0]}, ${r.worldY[1]}]`);

await browser.close();
await server.close();
