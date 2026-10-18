import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { createServer } from "vite";

mkdirSync("shots", { recursive: true });

const server = await createServer({ server: { port: 5199 } });
await server.listen();

const browser = await chromium.launch({ channel: "msedge" });
const sizes = [
  [1024, 768, "desktop.png"],
  [390, 844, "mobile.png"],
];
for (const [w, h, name] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto("http://localhost:5199");
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    if (window.PSXCC) {
      if (PSXCC.setAuto) PSXCC.setAuto(false);
      PSXCC.controls.yaw = 0;
    }
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: `shots/${name}` });
  // M9: Export panel before Photo Studio (GLB -> OBJ+TEX -> print rows ->
  // mesh-check report). The print CHECK runs the real pipeline (~seconds).
  await page.click("#btnGlb");
  await page.waitForTimeout(250);
  await page.screenshot({ path: `shots/m9_export_glb_${name}` });
  const fmt = "#exOpts .psRow:nth-child(1) .psSeg button";
  await page.click(`${fmt}:nth-child(2)`); // OBJ+TEX
  await page.waitForTimeout(200);
  await page.screenshot({ path: `shots/m9_export_display_${name}` });
  await page.click(`${fmt}:nth-child(3)`); // OBJ PRINT (shows the print rows)
  await page.waitForTimeout(200);
  await page.screenshot({ path: `shots/m9_export_print_${name}` });
  await page.click("#exDownload"); // CHECK + EXPORT -> report view
  await page.waitForFunction(
    () => !document.getElementById("exReport")?.hidden,
    null, { timeout: 30000 }
  );
  await page.waitForTimeout(250);
  await page.screenshot({ path: `shots/m9_export_report_${name}` });
  await page.click("#exReportBack");
  await page.waitForTimeout(150);
  await page.keyboard.press("Escape"); // close Export
  // M8: Photo Studio modal open (same viewport, one shot each)
  await page.click("#btnCamera");
  await page.waitForTimeout(700); // preview render (debounced)
  await page.screenshot({ path: `shots/m8_photo_studio_${name}` });
  await page.close();
}
await browser.close();
await server.close();
console.log("shots saved to /shots");
