import * as THREE from "three";
import "./style.css";
import { createPSXRenderer, makePSXMaterial } from "./psxRenderer.js";
import { createCharacter, DEFAULT_SKIN } from "./character.js";
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

// M6: style-pack tops/bottoms/shoes + socks slot + patterns + Style tab.

const CLOTH_SLOTS = ["top", "outer", "bottom", "socks", "shoes"];
const ACC_SLOTS = ["headwear", "eyewear", "neck", "wrist", "bag"];
const ALL_SLOTS = [...CLOTH_SLOTS, ...ACC_SLOTS];

const state = {
  skin: DEFAULT_SKIN, eyes: 3, mouth: 1, blush: false,
  hair: { id: "hair_01", color: "#ffffff" },
  top: { id: "top_tee", colors: { main: "#e06060" } },
  outer: null,
  bottom: { id: "bot_long_pants", colors: { main: "#3a5ca8" } },
  socks: null,
  shoes: { id: "shoe_sneaker", colors: { main: "#e8913a" } },
  headwear: null, eyewear: null,
  neck: null, wrist: null, bag: null,
};

// debug: ?hair=hair_XX etc. lets the shot scripts capture specific items
const params = new URLSearchParams(location.search);
for (const slot of ALL_SLOTS) {
  const v = params.get(slot);
  if (v) {
    if (v === "none") state[slot] = null;
    else if (slot === "hair") state.hair.id = v;
    else state[slot] = { id: v, colors: state[slot]?.colors ?? {} };
  }
}
// optional debug colour for any URL-assigned slot: ?top=top_tee&c=#ff00ff
const urlColor = params.get("c");
for (const slot of ALL_SLOTS) {
  if (urlColor && slot !== "hair" && state[slot]?.id)
    state[slot].colors.main = urlColor;
}

const canvas = document.getElementById("view");
const { render } = createPSXRenderer(canvas);

const scene = new THREE.Scene();
scene.background = null;
const camera = new THREE.PerspectiveCamera(42, 480 / 360, 0.1, 50);
camera.position.set(0, 1.02, 3.35);
camera.lookAt(0, 0.98, 0);

const ground = new THREE.Mesh(
  new THREE.CircleGeometry(1.4, 10),
  new THREE.MeshBasicMaterial({ color: "#e8d8a0" })
);
ground.rotation.x = -Math.PI / 2;

const character = createCharacter();

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
const headAnchor = character.root.children.find((c) => c.position.y === 1.48);
// 1.5x face feature scale: planes enlarged about each feature's centre so
// eyes/mouth grow without drifting (anchor = eye-row centre / mouth centre)
const eyesMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(0.75, 0.66),
  makePSXMaterial("#ffffff", { map: eyesTex, gradient: 0.05 })
);
eyesMesh.position.set(0, -0.0941, 0.368); // extra -0.05: keeps brows clear of the fringe
const mouthMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(0.75, 0.66),
  makePSXMaterial("#ffffff", { map: mouthTex, gradient: 0.05 })
);
mouthMesh.position.set(0, -0.16, 0.371); // tiny offset: avoids vertex-snap shimmer
headAnchor.add(eyesMesh, mouthMesh);

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

function applyHair() {
  if (!state.hair) {
    if (hairMat) {
      character.hairAnchor.remove(character.hairAnchor.children[0]);
      hairMat = null;
      hairCurrent = null;
    }
    return;
  }
  const { id, color } = state.hair;
  if (id !== hairCurrent) {
    if (hairMat) character.hairAnchor.remove(character.hairAnchor.children[0]);
    hairCurrent = id;
    const built = createHair(id, color);
    if (built.mat) {
      character.hairAnchor.add(built.group);
      hairMat = built.mat;
    } else {
      hairMat = null;
    }
  }
  if (hairMat) hairMat.uniforms.color.value.set(color);
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
  if (!item) return mount(slot, null);
  const colors = state[slot].colors;
  let built;
  const flags = {
    cropped: !!item.cropped,
    lowRise: !!item.lowRise,
    wide: !!item.wide,
  };
  if (item.slot === "top" || item.slot === "outer") {
    built = createTop(item.id, colors, flags, item.pattern);
    // top geometry is built around the torso centre (world y 0.88)
    built.group.position.y = 0.88;
  } else if (item.slot === "bottom") {
    built = createBottom(item.id, colors, flags, item.pattern);
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

createUI(state, { onChange: applyAll });

// ?preset= applies a catalog preset on load (shot scripts / shareable links);
// ?hue= makes the auto colour-block deterministic
const startPreset = params.get("preset");
const startHue = params.get("hue");
if (startPreset) {
  const preset = catalog.presets.find((p) => p.id === startPreset);
  if (preset) applyPreset(preset, state, applyAll);
  if (startHue) applyColourBlock(state, applyAll, Number(startHue));
}

function applyAll() {
  applyFace();
  applyHair();
  for (const slot of ALL_SLOTS) {
    applyCloth(slot);
    recolor(slot);
  }
}
applyAll();

let auto = true;
const controls = createControls({
  getAuto: () => auto,
  setAuto: (v) => (auto = v),
});
controls.addYaw((y) => (character.root.rotation.y = y));

const clock = new THREE.Clock();
function tick() {
  const dt = clock.getDelta();
  if (auto) controls.yaw += dt * 0.7;
  render(scene, camera);
  requestAnimationFrame(tick);
}
tick();

// debug hook for screenshots/tests (M0+/M2): stable yaw for deterministic shots
window.PSXCC = {
  controls, state, setAuto: (v) => (auto = v), applyAll,
  scene, camera,
  character,
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
