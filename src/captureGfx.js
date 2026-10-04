import * as THREE from "three";
import "./psxRenderer.js"; // keeps THREE.ColorManagement off app-wide
import { CaptureError } from "./captureCompose.js";

// Offscreen WebGL plumbing for the capture pipeline: the singleton renderer
// (never inserted into the DOM -> no UI overlays can leak in), the vertex-snap
// uniform save/patch for the Clean look and the capture-only shadow blob.
// Split from capture.js to keep files lean.

const BASE_W = 480;

let off = null; // { canvas, renderer } singleton; recreated after context loss
export function disposeOffRenderer() {
  if (!off) return;
  try {
    off.renderer.forceContextLoss();
    off.renderer.dispose();
  } catch { /* already gone */ }
  off = null;
}

export function ensureRenderer() {
  if (off) return off;
  const canvas = document.createElement("canvas");
  canvas.width = BASE_W;
  canvas.height = 360;
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false });
  } catch {
    throw new CaptureError("NO_RENDERER", "WebGL offscreen renderer unavailable");
  }
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // raw sRGB like main
  renderer.setClearColor(0x000000, 0);
  canvas.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    off = null; // next capture lazily recreates a fresh context
  });
  off = { canvas, renderer };
  return off;
}

// temporarily stop vertex snapping for the Clean look (uniform per material,
// restored afterwards; the live look never keeps the patch)
export function snapUniforms(root, value) {
  const touched = [];
  root.traverse((o) => {
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const mt of mats) {
      if (mt?.isShaderMaterial && mt.uniforms?.res) touched.push(mt);
    }
  });
  const saved = touched.map((mt) => ({ mt, v: mt.uniforms.res.value }));
  const restore = () => {
    for (const { mt, v } of saved) mt.uniforms.res.value = v;
  };
  if (value === null) return { restore };
  for (const { mt } of saved) mt.uniforms.res.value = value;
  return { restore };
}

// shadow blob: flat dark ellipse under the character, capture-only
let shadowMesh = null;
export function ensureShadow() {
  if (shadowMesh) return shadowMesh;
  // 14-seg circle lying flat: chunky PSX-friendly ellipse, no soft blur
  const geo = new THREE.CircleGeometry(1, 14);
  shadowMesh = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      color: "#3a2a14", transparent: true, opacity: 0.28, depthWrite: false,
    })
  );
  shadowMesh.rotation.x = -Math.PI / 2;
  return shadowMesh;
}
