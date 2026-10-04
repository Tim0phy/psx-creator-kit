import * as THREE from "three";
import "./psxRenderer.js"; // ensures THREE.ColorManagement stays off app-wide
import {
  paintBackground, drawName, toPng, CaptureError,
} from "./captureCompose.js";

// M8 Photo Studio capture engine. Dedicated OFFSCREEN renderer (never in the
// DOM -> no UI overlays can leak in; the visible #view canvas is untouched).
// PSX look = render at the low base resolution (480 wide, like RES_W) and
// nearest-upscale on a 2D composite canvas (identical math to the live
// low-res-render-target + CSS pixelated pipeline, no extra RT needed).
// Clean look = same scene rendered straight at full output size (flat
// low-poly, vertex-ish colours, vertex-snap uniform raised so geometry is
// smooth; material colours/patterns untouched). Everything stays local.

THREE.ColorManagement.enabled = false; // idempotent with psxRenderer.js

export const CAPTURE_MAX = 4096; // longest-side cap (device safety)
export const ASPECTS = ["1:1", "4:3", "3:4", "9:16"];
export const LOOKS = ["psx", "clean"];
export const VIEWS = ["current", "front", "side", "back"];
export const BG_TYPES = ["transparent", "checker", "solid"];

// checker tokens live in captureCompose.js (used for page-matching backgrounds)
const BASE_W = 480; // PSX base render width (matches psxRenderer RES_W)
const FOV = 42; // degrees, same as the live camera
const MARGIN = 1.07; // auto-frame head-room factor
// main camera view direction (0,1.05,4.3) -> lookAt (0,0.95,0), normalized:
const VIEW_DIR = new THREE.Vector3(0, -0.1, -4.3).normalize();
export { CaptureError }; // re-export (the class itself lives in captureCompose)

// ---------------------------------------------------------------- dimensions
// base size: fixed 480 width; height from the aspect (rounded)
export function baseDims(aspect) {
  const [a, b] = String(aspect).split(":").map(Number);
  if (!a || !b) return [BASE_W, 360];
  return [BASE_W, Math.max(1, Math.round((BASE_W * b) / a))];
}

// scale then device-cap; returns [w, h, capped]. scale outside {1,2,4}
// clamps down to the closest legal step (>4 -> 4x; fractional -> 1x); the
// raw flag skips sanitization for the pure calculator hook (test-only).
export function scaledDims(aspect, scale, raw = false) {
  const [bw, bh] = baseDims(aspect);
  const s = raw || [1, 2, 4].includes(scale)
    ? (raw ? Math.max(1, Number(scale) || 1) : scale)
    : scale > 4 ? 4 : 1;
  let w = Math.round(bw * s);
  let h = Math.round(bh * s);
  const longest = Math.max(w, h);
  if (longest > CAPTURE_MAX) {
    const k = CAPTURE_MAX / longest;
    w = Math.max(1, Math.round(w * k));
    h = Math.max(1, Math.round(h * k));
    return [w, h, true];
  }
  return [w, h, false];
}

// ---------------------------------------------------------------- renderer
// the offscreen renderer / snap patch / shadow blob live in captureGfx.js
import { ensureRenderer, snapUniforms, ensureShadow } from "./captureGfx.js";
export { disposeOffRenderer } from "./captureGfx.js";

// ------------------------------------------------------- scene state voodoo
const VIEW_YAW = { front: 0, side: Math.PI / 2, back: Math.PI };

// ------------------------------------------------------------- auto framing
function computeFit(box, outW, outH) {
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const tanY = Math.tan((FOV / 2) * (Math.PI / 180));
  const tanX = tanY * (outW / outH);
  const distY = (size.y / 2) / tanY;
  const distX = (size.x / 2) / tanX;
  const dist = Math.max(distY, distX) * MARGIN + size.z / 2 + 0.05;
  const camera = new THREE.PerspectiveCamera(FOV, outW / outH, 0.05, dist * 4 + 10);
  // VIEW_DIR is the camera->target direction; the CAMERA sits on the opposite
  // side (center - viewDir * dist) so front view faces the +Z camera like the
  // live view does.
  camera.position.copy(center).addScaledVector(VIEW_DIR, -dist);
  camera.lookAt(center);
  return { camera, dist, center };
}

// ---------------------------------------------------------------- capture
// setup: { scene, character: () => ch, platform: groundMesh }
// options: view/background{type,color}/look/scale/aspect/showName/name/
//          platform/shadow. Returns a fresh <canvas> (never a live one).
export async function captureToCanvas(setup, opt) {
  const scene = setup.scene;
  const ch = setup.character?.();
  if (!ch) throw new CaptureError("API", "character unavailable");
  // background: {type,color} object or "transparent"|"checker"|"solid" shorthand
  const bgRaw = opt.background ?? { type: "transparent" };
  const bg = typeof bgRaw === "string" ? { type: bgRaw, color: "#e8913a" } : bgRaw;
  const opts = {
    view: VIEWS.includes(opt.view) ? opt.view : "current",
    look: LOOKS.includes(opt.look) ? opt.look : "psx",
    scale: opt.scale,
    aspect: ASPECTS.includes(opt.aspect) ? opt.aspect : "4:3",
    showName: !!opt.showName,
    name: String(opt.name ?? "").trim().slice(0, 12),
    platform: !!opt.platform,
    shadow: !!opt.shadow,
    fixedDist: Number(opt.fixedDist) || 0,
    background: {
      type: BG_TYPES.includes(bg.type) ? bg.type : "transparent",
      color: typeof bg.color === "string" ? bg.color : "#e8913a",
    },
  };
  const [ow, oh, capped] = scaledDims(opts.aspect, opts.scale);
  const { canvas: glc, renderer } = ensureRenderer();
  const root = ch.root;
  const ground = setup.platform ?? null;

  // ---- save + mutate scene state (mutate/restore stays synchronous) --------
  const yaw0 = root.rotation.y;
  const groundWas = ground ? ground.visible : null;
  let shadow = null;
  if (opts.shadow) {
    shadow = ensureShadow();
    scene.add(shadow);
  }
  const clean = snapUniforms(root, opts.look === "clean" ? 2400 : null);

  try {
    // view yaw (temporary; exact value restored below)
    let yaw = yaw0;
    if (opts.view !== "current") yaw = VIEW_YAW[opts.view];
    root.rotation.y = yaw;

    ground && (ground.visible = opts.platform);
    scene.updateMatrixWorld(true);

    // shadow follows the character footprint (before framing!)
    if (shadow) {
      const box0 = new THREE.Box3().setFromObject(root);
      const c = box0.getCenter(new THREE.Vector3());
      const s = box0.getSize(new THREE.Vector3());
      shadow.position.set(c.x, 0.006, c.z);
      shadow.scale.set(Math.max(0.6, s.x * 0.62), 1, Math.max(0.6, s.z * 0.66));
    }

    // include everything that will render so nothing is cropped:
    const box = new THREE.Box3();
    box.setFromObject(root);
    if (opts.platform && ground) box.union(new THREE.Box3().setFromObject(ground));
    if (shadow) box.union(new THREE.Box3().setFromObject(shadow));
    // reserve a name band below the character
    if (opts.showName) box.min.y -= box.getSize(new THREE.Vector3()).y * 0.16;

    // render pass: PSX at base res, Clean straight at output res
    const [rw, rh] = opts.look === "psx" ? baseDims(opts.aspect) : [ow, oh];
    renderer.setSize(rw, rh, false);
    const fit = computeFit(box, rw, rh);
    if (opts.fixedDist) {
      // identical-distance framing (turnaround consistency): same dir/center,
      // but the distance is shared across views so panels keep one scale
      fit.camera.position.copy(fit.center).addScaledVector(VIEW_DIR, -opts.fixedDist);
    }
    const camera = opt.cameraOverride ?? fit.camera;
    renderer.render(scene, camera);

    // ---- 2D composite (background under the GL pixels, name on top) ---------
    const out = document.createElement("canvas");
    out.width = ow;
    out.height = oh;
    const ctx = out.getContext("2d");
    ctx.imageSmoothingEnabled = false; // NN upscale keeps PSX pixels sharp
    paintBackground(ctx, opts.background, ow, oh);
    ctx.drawImage(glc, 0, 0, ow, oh);
    if (opts.showName) drawName(ctx, opts.name, ow, oh);
    if (capped) out._capped = true;
    out._dims = [ow, oh];
    return out;
  } finally {
    // synchronous restore: main render loop can never see the mutated state
    root.rotation.y = yaw0;
    if (ground) ground.visible = groundWas;
    if (shadow) scene.remove(shadow);
    clean.restore();
  }
}

// public API: captureCharacter(options) -> Promise<Blob>  (transparent PNG)
export async function captureCharacter(setup, options) {
  let canvas;
  try {
    canvas = await captureToCanvas(setup, options);
  } catch (err) {
    if (err instanceof CaptureError) throw err;
    throw new CaptureError("API", String(err?.message ?? err), err);
  }
  return toPng(canvas);
}

// modal-facing aliases: 1) canvas for previews/filenames, 2) canvas -> PNG blob
export { captureToCanvas as captureRaw };
export const blobFromCanvas = (canvas) => toPng(canvas);

// --------------------------------------------------------- turnaround sheet
// three views side by side, consistent scale + background (+ optional name).
// Per-view boxes differ after the yaw (width/depth trade), so every panel is
// framed against the LARGEST per-view distance -> one shared scale, aligned
// bottoms; panels render at base res then NN-upscale together.
export async function captureTurnaround(setup, opt) {
  const aspect = ASPECTS.includes(opt.aspect) ? opt.aspect : "4:3";
  const scale = [1, 2, 4].includes(opt.scale) ? opt.scale : 1;
  const views = ["front", "side", "back"];
  const yawOf = { front: VIEW_YAW.front, side: VIEW_YAW.side, back: VIEW_YAW.back };

  // per-view fit measure (no render): largest wins
  const scene = setup.scene;
  const ch = setup.character?.();
  if (!ch) throw new CaptureError("API", "character unavailable");
  const [bw, bh] = baseDims(aspect);
  const yaw0 = ch.root.rotation.y;
  try {
    let maxDist = 0;
    for (const view of views) {
      const r = ch.root;
      r.rotation.y = yawOf[view];
      scene.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(r);
      if (opt.showName) box.min.y -= box.getSize(new THREE.Vector3()).y * 0.16;
      const fit = computeFit(box, bw, bh);
      if (fit.dist > maxDist) maxDist = fit.dist;
    }
    ch.root.rotation.y = yaw0; // measure pass is non-destructive

    const panels = [];
    for (const view of views) {
      panels.push(await captureToCanvas(setup, {
        ...opt, view, showName: false, fixedDist: maxDist,
      }));
    }
    const [pw, ph] = panels[0]._dims;
    let W = pw * 3;
    let H = ph;
    const longest = Math.max(W, H); // page cap on the whole sheet
    if (longest > CAPTURE_MAX) {
      const k = CAPTURE_MAX / longest;
      W = Math.round(W * k);
      H = Math.round(H * k);
    }
    const sheet = document.createElement("canvas");
    sheet.width = W;
    sheet.height = H;
    const ctx = sheet.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    paintBackground(ctx, opt.background ?? { type: "transparent" }, W, H);
    const dw = W / 3;
    panels.forEach((p, i) => ctx.drawImage(p, i * dw, 0, dw, H));
    if (opt.showName) drawName(ctx, opt.name ?? "", W, H);
    for (const p of panels) { p.width = 0; p.height = 0; } // free backing
    const blob = await toPng(sheet);
    return { blob, dims: [W, H] };
  } finally {
    ch.root.rotation.y = yaw0;
  }
}
