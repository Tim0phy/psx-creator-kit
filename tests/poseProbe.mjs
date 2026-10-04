import { chromium } from "playwright";
import { createServer } from "vite";

// Vertex-level exposure probe: for every skin mesh (torso / thigh / shin /
// foot), classify each vertex as INSIDE or OUTSIDE every candidate cover
// volume (garment OBBs), then report how much skin is left uncovered.
// Used to verify pose-clipping fixes with numbers, not pixels.

const server = await createServer({ server: { port: 5211 } });
await server.listen();

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
await page.goto("http://localhost:5211", { waitUntil: "load" });
await page.waitForTimeout(700);

const OUTFITS = [
  { tag: "pants", bottom: "bot_long_pants", shoes: "shoe_sneaker" },
  { tag: "shorts_boots", bottom: "bot_shorts", shoes: "shoe_knee_boots" },
  { tag: "long_skirt", bottom: "bot_long_skirt", shoes: "shoe_sneaker" },
  { tag: "male_pants", body: "male", bottom: "bot_long_pants", shoes: "shoe_sneaker" },
];const probeFn = () => {
  const scene = PSXCC.scene;
  const Meshes = [];
  scene.traverse((o) => { if (o.isMesh) Meshes.push(o); });

  const hex = (m) => {
    const c = m.material?.uniforms?.color?.value;
    return c ? c.getHexString() : "";
  };
  const isSkin = (m) => hex(m) === "f5d5bf" || hex(m) === "e6d3c4";
  const vproto = Object.getPrototypeOf(scene.position).constructor; // Vector3
  const mproto = Object.getPrototypeOf(scene.matrixWorld).constructor; // Matrix4

  const covers = [];
  const skins = [];
  for (const m of Meshes) {
    if (m.material?.type === "MeshBasicMaterial") continue; // ground
    m.geometry.computeBoundingBox();
    if (isSkin(m)) skins.push(m);
    else {
      const bb = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);
      if (bb.min.y < 1.05 && bb.max.y > -0.2) covers.push(m);
    }
  }
  const inv = new mproto();
  const coversX = covers.map((c) => ({
    inv: inv.copy(c.matrixWorld).invert().clone(),
    bb: c.geometry.boundingBox.clone(),
  }));

  const tmp = new vproto(), V = new vproto();
  const sizeKey = (m) => {
    const b = m.geometry.boundingBox;
    return `w${+(b.max.x - b.min.x).toFixed(2)} h${+(b.max.y - b.min.y).toFixed(2)} d${+(b.max.z - b.min.z).toFixed(2)}`;
  };
  // exposure depth of a point: how far OUTSIDE the nearest cover box (0 if inside)
  const depthBox = (p, b) => {
    const dx = Math.max(b.min.x - p.x, p.x - b.max.x, 0);
    const dy = Math.max(b.min.y - p.y, p.y - b.max.y, 0);
    const dz = Math.max(b.min.z - p.z, p.z - b.max.z, 0);
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  };

  const report = [];
  for (const m of skins) {
    m.geometry.computeBoundingBox();
    const total = m.geometry.attributes.position.count;
    let scanned = 0;
    let d12 = 0, d50 = 0, d150 = 0;
    const worst50 = [];
    for (let i = 0; i < total; i++) {
      V.fromBufferAttribute(m.geometry.attributes.position, i)
        .applyMatrix4(m.matrixWorld);
      if (V.y > 1.05 || V.y < -0.2) continue;
      scanned++;
      let dmin = Infinity;
      for (const c of coversX) {
        tmp.copy(V).applyMatrix4(c.inv);
        const d = depthBox(tmp, c.bb);
        if (d < dmin) dmin = d;
      }
      if (dmin > 0.012) {
        d12++;
        if (dmin > 0.05) {
          d50++;
          if (dmin > 0.15) d150++;
          if (worst50.length < 6) {
            worst50.push({ d: +dmin.toFixed(3), p: [+V.x.toFixed(2), +V.y.toFixed(2), +V.z.toFixed(2)] });
          }
        }
      }
    }
    if (scanned && d12) {
      report.push({
        label: sizeKey(m), exposed: d12, deep50: d50, deep150: d150,
        scanned, worst50,
      });
    }
  }
  const feet = {};
  for (const [k, j] of Object.entries(PSXCC.character.joints)) {
    const w = new vproto();
    j.getWorldPosition(w);
    feet[k] = [+w.x.toFixed(2), +w.y.toFixed(2), +w.z.toFixed(2)];
  }
  return { feet, report };
};

const all = [];
for (const outfit of OUTFITS) {
  await page.evaluate((o) => {
    const s = PSXCC.state;
    s.body = o.body ?? "female";
    s.hair = null;
    s.top = { id: "top_tee", colors: { main: "#e06060" } }; // tee always on
    s.outer = null; s.socks = null;
    s.bottom = o.bottom === null ? null : { id: o.bottom, colors: { main: "#3a5ca8" } };
    s.shoes = o.shoes === null ? null : { id: o.shoes, colors: { main: "#e8913a" } };
    s.headwear = null; s.eyewear = null; s.neck = null; s.wrist = null; s.bag = null;
    PSXCC.applyAll();
  }, outfit);
  for (const poseId of await page.evaluate(() => PSXCC.pose.list())) {
    await page.evaluate((id) => PSXCC.pose.preset(id), poseId);
    await page.waitForTimeout(60);
    const r = await page.evaluate(probeFn);
    all.push({ outfit: outfit.tag, pose: poseId.replace("pose_", ""), ...r });
  }
}

for (const r of all) {
  const bad = r.report.filter((x) => x.exposed > 0);
  if (!bad.length) continue;
  console.log(`\n== ${r.outfit} / ${r.pose} ==`);
  for (const b of bad) {
    console.log(
      `  ${b.label}: >12mm ${b.exposed}/${b.scanned} | >50mm ${b.deep50} | >150mm ${b.deep150} at`,
      JSON.stringify(b.worst50)
    );
  }
}

await browser.close();
await server.close();
console.log("\nprobe done");
