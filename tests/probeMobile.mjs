import { chromium } from "playwright";
import { mkdirSync } from "fs";
import { createServer } from "vite";

mkdirSync("shots/probe", { recursive: true });

const server = await createServer({ server: { port: 5199 } });
await server.listen();

const browser = await chromium.launch({ channel: "msedge" });
const sizes = [
  [390, 844, "mob390"],
  [360, 740, "mob360"],
  [320, 568, "mob320"],
  [740, 360, "land360"],
];
for (const [w, h, name] of sizes) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  for (const cat of ["head", "top", "accessories", "pose", "style"]) {
    await page.goto(`http://localhost:5199/?cat=${cat}`);
    await page.waitForTimeout(600);
    await page.evaluate(() => {
      if (window.PSXCC?.setAuto) PSXCC.setAuto(false);
    });
    await page.waitForTimeout(200);
    await page.screenshot({ path: `shots/probe/${name}_${cat}.png` });
  }
  await page.close();
}
await browser.close();
await server.close();
console.log("probe shots saved");
