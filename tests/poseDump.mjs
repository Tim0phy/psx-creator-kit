import { chromium } from "playwright";
import { createServer } from "vite";

// Numeric pose audit: dump world-space AABBs of every relevant mesh
// (body skin vs garments) so clipping can be verified with numbers
// instead of eyeballing low-res screenshots.

const server = await createServer({ server: { port: 5211 } });
await server.listen();

const browser = await chromium.launch({ channel: "msedge" });
const page = await browser.newPage({ viewport: { width: 640, height: 480 } });
await page.goto("http://localhost:5211", { waitUntil: "load" });
await page.waitForTimeout(700);

const OUTFITS = [
  { tag: "pants", bottom: "bot_long_pants", shoes: "shoe_sneaker" },
  { tag: "shorts_boots", bottom: "bot_shorts", shoes: "shoe_knee_boots" },
];

const dumpFn = () => {
  const scene = PSXCC.scene;
  const rows = [];
  scene.traverse((o) => {
    if (!o.isMesh && !o.isGroup) return;
    // label: joint path-ish, from userData or geometry size
    const p = o.parent;
    const size = o.geometry ? o.geometry.boundingBox : null;
    let bb = null;
    if (o.isMesh) {
      o.geometry.computeBoundingBox();
      bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
    }
    rows.push({
      kind: o.isMesh ? "mesh" : "group",
      name: o.name || (o.userData?.clothPart ? "cloth:" + o.userData.clothPart : ""),
      cloth: o.userData?.clothPart ?? (p?.userData?.clothPart ?? null),
      flare: o.userData?.flare ?? null,
      size: size ? [
        +(size.max.x - size.min.x).toFixed(3),
        +(size.max.y - size.min.y).toFixed(3),
        +(size.max.z - size.min.z).toFixed(3)] : null,
      bb: bb ? [[+bb.min.x.toFixed(3), +bb.min.y.toFixed(3), +bb.min.z.toFixed(3)],
                [+bb.max.x.toFixed(3), +bb.max.y.toFixed(3), +bb.max.z.toFixed(3)]] : null,
      pos: o.isMesh ? null : o.position.toArray().map((v) => +v.toFixed(3)),
      skinned: o.isMesh && o.material?.uniforms?.color
        ? "#" + o.material.uniforms.color.value.getHexString() : null,
    });
  });
  const J = PSXCC.character.joints;
  const joints = {};
  for (const [k, v] of Object.entries(J)) {
    const w = new (Object.getPrototypeOf(v.position).constructor)();
    v.getWorldPosition(w);
    joints[k] = [+w.x.toFixed(3), +w.y.toFixed(3), +w.z.toFixed(3)];
  }
  return { joints, rows: rows.filter((r) => r.bb) };
};

const out = [];
for (const outfit of OUTFITS) {
  await page.evaluate((o) => {
    const s = PSXCC.state;
    s.body = "female";
    s.hair = null;
    s.top = null; s.outer = null; s.socks = null;
    s.bottom = o.bottom === null ? null : { id: o.bottom, colors: { main: "#3a5ca8" } };
    s.shoes = o.shoes === null ? null : { id: o.shoes, colors: { main: "#e8913a" } };
    s.headwear = null; s.eyewear = null; s.neck = null; s.wrist = null; s.bag = null;
    PSXCC.applyAll();
  }, outfit);

  for (const poseId of ["pose_default", "pose_run", "pose_sit"]) {
    const data = await page.evaluate((id) => {
      PSXCC.pose.preset(id);
      // force full matrix refresh
      PSXCC.scene.updateMatrixWorld(true);
      return null;
    }, poseId);
    void data;
    await page.waitForTimeout(80);
    const dump = await page.evaluate(dumpFn);
    out.push({ outfit: outfit.tag, pose: poseId, ...dump });
  }
}

// report: for each pose, print joint positions + the interesting AABBs
for (const rec of out) {
  console.log(`\n=== ${rec.outfit} / ${rec.pose} ===`);
  console.log("joints:", JSON.stringify(rec.joints));
  for (const r of rec.rows) {
    const label = r.name || r.cloth || "?";
    const s = r.size ? `size[${r.size}]` : "";
    console.log(
      `${label.padEnd(18)} ${s} aabb min[${r.bb[0]}] max[${r.bb[1]}] ${r.skinned ?? ""}`
    );
  }
}

await browser.close();
await server.close();
