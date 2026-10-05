import * as THREE from "three";
import "./style.css";
import "./poseUI.css";
import { createPSXRenderer, makePSXMaterial } from "./psxRenderer.js";
import { createCharacter } from "./character.js";
import { createControls } from "./controls.js";
import { makeFaceTexture, renderEyes, renderMouth } from "./faceTexture.js";
import { createHair } from "./parts/hair.js";
import { createTop } from "./parts/tops.js";
import { createBottom } from "./parts/bottoms.js";
import { createShoes } from "./parts/shoes.js";
import { createSocks } from "./parts/socks.js";
import { createAccessory } from "./parts/accessories.js";
import catalog from "./catalog.js";
import { HAT_FIT, BARE_HEAD_FIT } from "./parts/hair.js";
import { createUI } from "./ui.js";
import {
  applyPreset, applyColourBlock,
} from "./uiStyle.js";
import {
  ALL_SLOTS, defaultState, applyUrlState, resetInto, randomizeInto,
  sanitizePose, applySaveConfig, toSaveConfig,
} from "./state.js";
import { createPoseEngine } from "./pose.js";
import {
  load, initNameSave, initJsonTransfer, showSaved, saveNow, currentName,
} from "./uiState.js";
import { initStateInspector } from "./uiDebug.js";
import "./captureUI.css";
import { initCaptureUI } from "./uiCapture.js";
import {
  captureCharacter, captureTurnaround, scaledDims, CAPTURE_MAX,
} from "./capture.js";
import {
  exportCharacterGLB, glbFilename,
} from "./exporter.js";

// M8 body selector: `state.body` ("female" | "male") rebuilds the whole
// character root (rig, face decals, hair and every clothing item re-mount).
// M6.5 pose system: the joint pivots live in character.js; the engine in
// pose.js rotates them from state.pose and re-parents tagged garment pieces
// onto their joints after every mount.

const state = defaultState();
// build beacon: logged to the console so a stale tab (one that missed HMR /
// kept old modules alive) is identifiable at a glance. The tab title stays
// clean "PSX Character Creator" because the <title> is also the share-card
// / search-result heading once deployed (e.g. GitHub Pages).
const BUILD = "r7";
console.info(`[psxcc] build ${BUILD}`);
// M7: the previous restoreInto() copied saved values raw; the boot restore
// now runs through the same validation as JSON import (unknown ids, bad
// colours, corrupt JSON and shape errors all fall back via applySaveConfig)
const bootReport = applySaveConfig(state, load());
sanitizePose(state);
if (bootReport.warnings.length)
  console.info("[psxcc] save restore warnings:", bootReport.warnings);

const params = new URLSearchParams(location.search);
applyUrlState(state, params);

const canvas = document.getElementById("view");
const { render } = createPSXRenderer(canvas);

const scene = new THREE.Scene();
scene.background = null;
const camera = new THREE.PerspectiveCamera(42, 480 / 360, 0.1, 50);
camera.position.set(0, 1.05, 4.3);
camera.lookAt(0, 0.95, 0);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(1.4, 10),
  new THREE.MeshBasicMaterial({ color: "#e8d8a0" })
);
ground.rotation.x = -Math.PI / 2;

let character = createCharacter(state.body);
let builtBody = state.body;

// M6.5 pose engine: rotates the joint pivots from state.pose
const pose = createPoseEngine(state);
pose.setCharacter(character);

// hairstyles with hanging back/side pieces (pose keeps them behind the arms)
const LONG_HAIR = new Set(["hair_02", "hair_03", "hair_04", "hair_07", "hair_09", "hair_11"]);

// face decals: eyes and mouth are two separate transparent textures laid on
// top of the head mesh; the head itself keeps its own skin material so the
// skin colour/lighting can never mismatch the decal
function facePair() {
  const small = document.createElement("canvas");
  small.width = small.height = 32;
  const big = document.createElement("canvas");
  big.width = big.height = 128;
  return { small, big };
}
const eyesPair = facePair();
const mouthPair = facePair();
renderEyes(eyesPair.small, eyesPair.big, state);
renderMouth(mouthPair.small, mouthPair.big, state);
const eyesTex = makeFaceTexture(eyesPair.big);
const mouthTex = makeFaceTexture(mouthPair.big);
// 1.5x face feature scale: planes enlarged about each feature's centre so
// eyes/mouth grow without drifting (anchor = eye-row centre / mouth centre)
const eyesMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(0.75, 0.66),
  makePSXMaterial("#ffffff", {
    map: eyesTex, gradient: 0.05,
    // z-fight guard: the decal sits ~0.007 in front of the head shell but
    // vertex-snap jitter (res 200) can invert that margin from some camera
    // yaws (M8 capture bug). polygonOffset pulls the decal toward the camera
    // in DEPTH ONLY - pixel look is unchanged.
    polygonOffset: true, polygonOffsetFactor: -4,
  })
);
eyesMesh.position.set(0, -0.0941, 0.368); // extra -0.05: keeps brows clear of the fringe
const mouthMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(0.75, 0.66),
  makePSXMaterial("#ffffff", {
    map: mouthTex, gradient: 0.05,
    polygonOffset: true, polygonOffsetFactor: -4,
  })
);
mouthMesh.position.set(0, -0.16, 0.371); // tiny offset: avoids vertex-snap shimmer
character.hairAnchor.add(eyesMesh, mouthMesh);

scene.add(ground, character.root);

function applyFace() {
  renderEyes(eyesPair.small, eyesPair.big, state);
  eyesTex.needsUpdate = true;
  renderMouth(mouthPair.small, mouthPair.big, state);
  mouthTex.needsUpdate = true;
  character.setSkin(state.skin); // whole-model skin follows the picker
}

// generic slot machinery: rebuild on id change, recolour otherwise
const CLOTH = {};
let hairCurrent = null;
let hairMat = null;
// the hair GROUP reference — the decal planes (eyes/mouth) live in
// hairAnchor too, so the old "remove children[0]" habit was deleting the
// eyes decal on every hairstyle switch (face then looked wiped/blank)
let hairGroup = null;

function applyHair() {
  if (!state.hair) {
    if (hairGroup) {
      character.hairAnchor.remove(hairGroup);
      hairGroup = null;
      hairMat = null;
      hairCurrent = null;
    }
    pose.hairLong = false;
    return;
  }
  const { id, color } = state.hair;
  if (id !== hairCurrent) {
    if (hairGroup) character.hairAnchor.remove(hairGroup);
    hairCurrent = id;
    const built = createHair(id, color);
    if (built.mat) {
      character.hairAnchor.add(built.group);
      hairMat = built.mat;
      hairGroup = built.group;
    } else {
      hairMat = null;
      hairGroup = null;
    }
  }
  if (hairMat) hairMat.uniforms.color.value.set(color);
  // M6.5: long hair shifts behind raised arms (rest look unchanged)
  pose.hairLong = LONG_HAIR.has(id);
  pose.applyPose(pose.current);
}

function catalogItem(slot) {
  if (!state[slot]) return null;
  return catalog.items.find((i) => i.id === state[slot].id) ?? null;
}

function mount(slot, built) {
  const parent = SLOT_ANCHOR[slot] ?? character.root;
  if (CLOTH[slot]) {
    if (CLOTH[slot].parent) CLOTH[slot].parent.remove(CLOTH[slot].group);
  }
  CLOTH[slot] = built ? { ...built, parent } : null;
  if (built) {
    parent.add(built.group);
    // layering draw order per STYLE.md sections 4/5
    const order = [...ALL_SLOTS];
    for (let i = order.indexOf(slot) + 1; i < order.length; i++) {
      if (CLOTH[order[i]]) CLOTH[order[i]].parent.add(CLOTH[order[i]].group);
    }
  }
}

function applyCloth(slot) {
  const item = catalogItem(slot);
  if (!item) {
    mount(slot, null);
    // release pieces re-parented onto joints (they are not children of the
    // slot group any more, so removing the group alone leaves ghosts)
    pose.attachCloth(slot, null);
    return;
  }
  const colors = state[slot].colors;
  let built;
  const flags = {
    cropped: !!item.cropped,
    lowRise: !!item.lowRise,
    wide: !!item.wide,
  };
  if (item.slot === "top" || item.slot === "outer") {
    built = createTop(item.id, colors, flags, item.pattern, state.body);
    // top geometry is built around the torso centre (world y 0.88)
    built.group.position.y = 0.88;
    // M6.5 follow-up: the torso shell rides the WAIST joint (tagged). It used
    // to stay a static root child, so at any waistTwist != 0 the shell never
    // followed the trunk and the trunk's hip/waist corners poked through the
    // shirt walls. attach() preserves rest world transforms, so rest pixels
    // are identical and twist/twist-following shells move with the upper body.
    built.group.userData.clothPart = "waist";
  } else if (item.slot === "bottom") {
    built = createBottom(item.id, colors, flags, item.pattern, state.body);
  } else if (item.slot === "socks") {
    built = createSocks(item.id, colors, item.pattern);
  } else if (item.slot === "shoes") {
    built = createShoes(item.id, colors);
  } else {
    // accessories: builders include all anchor-space offsets already
    // headwear hugs the current hairstyle's cap surface via its fit data
    const fit = item.slot === "headwear"
      ? (HAT_FIT[state.hair?.id] ?? BARE_HEAD_FIT)
      : null;
    built = createAccessory(item.id, colors, fit);
  }
  mount(slot, built);
  // M6.5: re-parent tagged garment pieces onto their joints (rest-preserving)
  const rec = CLOTH[slot];
  if (rec) {
    const jn = pose.attachCloth(slot, rec.group);
    if (jn) rec.parent = character.joints[jn];
  }
}

function recolor(slot) {
  const item = catalogItem(slot);
  if (!item || !CLOTH[slot]) return;
  const colors = state[slot].colors;
  if (CLOTH[slot].pattern) {
    CLOTH[slot].pattern.set(item.pattern, colors.main, colors.secondary);
    return;
  }
  // one material slot: main; secondary tracks the watcher's rules below
  if (CLOTH[slot].mat) CLOTH[slot].mat.uniforms.color.value.set(colors.main);
  if (CLOTH[slot].secMat && item.colorSlots?.includes("secondary")) {
    // two colour slots: secMat follows the user's secondary pick
    CLOTH[slot].secMat.uniforms.color.value.set(
      colors.secondary ?? colors.main
    );
  } else if (CLOTH[slot].secMat) {
    // one colour slot: secMat stays a derived darker shade of main
    CLOTH[slot].secMat.uniforms.color.value
      .set(colors.main).multiplyScalar(0.45);
  }
}

const SLOT_ANCHOR = {
  headwear: character.anchors.head,
  eyewear: character.anchors.head,
  neck: character.anchors.neck,
  wrist: character.anchors.wrist,
  bag: character.anchors.bag,
};

// M7: RANDOM/RESET via state.js
function applyAfterChange() {
  sanitizePose(state);
  applyAll();
  pose.sync({ animate: false });
}

function doReset() {
  resetInto(state);
  applyAfterChange();
}

document.getElementById("btnRandom").addEventListener("click", () => {
  randomizeInto(state, catalog);
  sanitizePose(state);
  applyAll();
  pose.sync({ animate: true }); // random pose preset, smooth stepped switch
});

document.getElementById("btnReset").addEventListener("click", doReset);

// last applySaveConfig warnings (boot restore / import) for the inspector
let lastImportWarnings = [];

// M7: JSON import (file) — validate, apply, write psxcc.v1 through so the
// imported look survives a reload
function importConfig(cfg, { persist = false } = {}) {
  const report = applySaveConfig(state, cfg);
  if (report.warnings.length)
    console.info("[psxcc] config import warnings:", report.warnings);
  lastImportWarnings = report.warnings;
  applyAfterChange();
  if (persist && report.ok) saveNow(state);
  if (report.name !== null) {
    const input = document.getElementById("nameInput");
    if (input) input.value = report.name;
  }
  return report;
}

const ui = createUI(state, {
  onChange: applyAll,
  onImport: (cfg) => importConfig(cfg, { persist: true }),
});

// ---- M8 Photo Studio + GLB export -------------------------------------------
// capture refs are resolved lazily (character may be rebuilt on body switch)
const captureSetup = () => ({
  scene,
  character: () => character,
  platform: ground,
});

// shared blob-downloader for GLB (Photo Studio owns its own PNG downloads)
function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

initCaptureUI({ getSetup: captureSetup, openEl: document.getElementById("btnCamera") });

document.getElementById("btnGlb").addEventListener("click", async () => {
  const btn = document.getElementById("btnGlb");
  btn.disabled = true;
  try {
    const res = await exportCharacterGLB(
      { character, platform: ground },
      { includePlatform: false, name: currentName() }
    );
    if (res.ok) {
      saveBlob(res.blob, glbFilename(currentName()));
      showSaved("GLB SAVED");
    } else {
      showSaved("GLB FAILED");
      console.warn("[psxcc] GLB export:", res.errors);
    }
  } catch (err) {
    showSaved("GLB FAILED");
    console.warn("[psxcc] GLB export error:", err);
  } finally {
    btn.disabled = false;
  }
});

// ?preset= applies a catalog preset on load (shot scripts / shareable links);
// ?hue= makes the auto colour-block deterministic
const startPreset = params.get("preset");
const startHue = params.get("hue");
if (startPreset) {
  const preset = catalog.presets.find((p) => p.id === startPreset);
  if (preset) applyPreset(preset, state, applyAll);
  if (startHue) applyColourBlock(state, applyAll, Number(startHue));
}

// ---- body rebuild (M8) ------------------------------------------------------
function disposeGroup(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    mats.forEach((mt) => {
      if (!mt) return;
      mt.map?.dispose();
      mt.dispose();
    });
  });
}

function rebuildCharacter() {
  builtBody = state.body;
  const old = character;
  // detach the re-usable face decals before disposing the old rig
  for (const m of [eyesMesh, mouthMesh]) m.removeFromParent();
  character = createCharacter(state.body);
  if (old) {
    scene.remove(old.root);
    disposeGroup(old.root);
  }
  scene.add(character.root);
  character.root.rotation.y = lastYaw;
  character.hairAnchor.add(eyesMesh, mouthMesh);
  SLOT_ANCHOR.headwear = character.anchors.head;
  SLOT_ANCHOR.eyewear = character.anchors.head;
  SLOT_ANCHOR.neck = character.anchors.neck;
  SLOT_ANCHOR.wrist = character.anchors.wrist;
  SLOT_ANCHOR.bag = character.anchors.bag;
  // M6.5: rebind the pose engine to the fresh joints + re-apply the pose
  pose.setCharacter(character);
  // force hair + items to re-mount onto the fresh anchors
  hairCurrent = null;
  hairMat = null;
  hairGroup = null;
}

function applyAll() {
  if (builtBody !== state.body) rebuildCharacter();
  applyFace();
  applyHair();
  for (const slot of ALL_SLOTS) {
    applyCloth(slot);
    recolor(slot);
  }
  // keep the engine's applied pose in step with state.pose on ANY rebuild
  // path (boot restore / body switch) — pose_preset exists only visually via
  // sync(); everything else left the engine frozen at REST angles, so a
  // saved pose preset reverted to pose_default on every reload
  pose.sync({ animate: false });
}
applyAll();

let auto = true;
const controls = createControls({
  getAuto: () => auto,
  setAuto: (v) => (auto = v),
});
let lastYaw = -0.5;
controls.addYaw((y) => {
  lastYaw = y;
  character.root.rotation.y = y;
});

// ---- M6.5 pose debug cycle (?debug=poses) -----------------------------------
// Cycles all pose presets across representative outfits (long skirt, pleated
// skirt, wide cargo, cropped top, jacket, long hair, ears, bag) for review.
// The shot script drives it deterministically: PSXCC.pose.debugAuto(false)
// then debugNext() once per screenshot.
const POSE_IDS = (catalog.poses ?? []).map((p) => p.id);
const DEBUG_OUTFITS = [
  { hair: "hair_02", bottom: "bot_long_skirt" },                          // long hair + long skirt
  { hair: "hair_01", top: "top_baby_tee", bottom: "bot_plaid_pleated" },  // cropped + pleats
  { hair: "hair_06", top: "top_jacket", bottom: "bot_cargo_wide" },       // jacket + cargo
  { hair: "hair_03", headwear: "acc_cat_ears", bottom: "bot_short_skirt",
    bag: "acc_baguette_bag" },                                            // ears + bag
];
let dbgOutfit = 0;
let dbgPose = 0;
let dbgActive = params.get("debug") === "poses";
let dbgAuto = dbgActive;
let dbgTimer = 0;

function applyDebugStep() {
  resetInto(state);
  const o = DEBUG_OUTFITS[dbgOutfit % DEBUG_OUTFITS.length];
  for (const [slot, id] of Object.entries(o)) {
    if (slot === "hair") state.hair = { id, color: "#ffffff" };
    else state[slot] = { id, colors: { main: "#c8748c" } };
  }
  state.pose = { preset: POSE_IDS[dbgPose % Math.max(1, POSE_IDS.length)], custom: null };
  applyAll();
  pose.sync({ animate: false });
}

const poseAPI = {
  list: () => [...POSE_IDS],
  preset: (id) => {
    state.pose = { preset: id, custom: null };
    pose.sync({ animate: false });
  },
  custom: (a) => {
    state.pose = { preset: "custom", custom: a };
    sanitizePose(state);
    pose.sync({ animate: false });
  },
  debugAuto: (v) => (dbgAuto = !!v),
  debugIndex: () => ({ outfit: dbgOutfit, pose: dbgPose, total: POSE_IDS.length }),
  debugNext: () => {
    dbgPose++;
    if (POSE_IDS.length && dbgPose >= POSE_IDS.length) {
      dbgPose = 0;
      dbgOutfit = (dbgOutfit + 1) % DEBUG_OUTFITS.length;
    }
    applyDebugStep();
    return poseAPI.debugIndex();
  },
};
if (dbgActive) applyDebugStep();

const clock = new THREE.Clock();
function tick() {
  const dt = clock.getDelta();
  if (auto) controls.yaw += dt * 0.7;
  pose.update(dt); // stepped preset interpolation (12-15 fps, ~0.25 s)
  if (dbgActive && dbgAuto) {
    dbgTimer += dt;
    if (dbgTimer >= 2.2) {
      dbgTimer = 0;
      poseAPI.debugNext();
    }
  }
  render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// debug hook for screenshots/tests (M0+/M2): stable yaw for deterministic shots
window.PSXCC = {
  controls, state, setAuto: (v) => (auto = v), applyAll,
  scene, camera,
  pose: poseAPI,
  ui: () => ui,
  build: BUILD,
  save: () => toSaveConfig(state, currentName()),
  saveNow: () => saveNow(state) && showSaved("SAVED"),
  importJSON: (cfg) => importConfig(cfg, { persist: false }),
  currentSave: () => load(),
  // M8: deterministic capture hooks for the Playwright suite
  captureSetup,
  capture: (opts) => captureCharacter(captureSetup(), opts),
  captureTurnaround: (opts) => captureTurnaround(captureSetup(), opts),
  captureDims: (aspect, scale, raw) => scaledDims(aspect, scale, raw),
  captureMax: CAPTURE_MAX,
  get character() {
    return character;
  },
  tris() {
    let t = 0;
    scene.traverse((o) => {
      if (o.isMesh && o.material.isShaderMaterial) {
        t += o.geometry.attributes.position.count / 3;
      }
    });
    console.log(`[psxcc] TOTAL clothed tris: ${t}`);
    return t;
  },
};

initStateInspector({
  state,
  getWarnings: () => lastImportWarnings,
});
