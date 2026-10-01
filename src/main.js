import * as THREE from "three";
import "./style.css";
import { createPSXRenderer, makePSXMaterial } from "./psxRenderer.js";
import { createCharacter, DEFAULT_SKIN } from "./character.js";
import { createControls } from "./controls.js";
import { makeFaceTexture, renderFace } from "./faceTexture.js";
import { createHair } from "./parts/hair.js";
import { createUI } from "./ui.js";

// M3: face system + hair (paper strips) on a head anchor.

const state = {
  skin: DEFAULT_SKIN, eyes: 3, mouth: 1, blush: false,
  hair: { id: "hair_01", color: "#ffffff" },
};

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

// face plane on the front of the head; only this texture is redrawn
const small = document.createElement("canvas");
small.width = small.height = 32;
const big = document.createElement("canvas");
big.width = big.height = 128;
renderFace(small, big, state);
const faceTex = makeFaceTexture(big);
const faceMesh = new THREE.Mesh(
  new THREE.PlaneGeometry(0.5, 0.44),
  makePSXMaterial("#ffffff", { map: faceTex, gradient: 0.05 })
);
faceMesh.position.set(0, -0.02, 0.368);
character.root.children.find((c) => c.position.y === 1.48).add(faceMesh);

scene.add(ground, character.root);

function applyFace() {
  renderFace(small, big, state); // redraw canvas only
  faceTex.needsUpdate = true;
  character.setSkin(state.skin); // whole-model skin follows the picker
}

// hair (M3): rebuild only when the style changed; recolour otherwise
let hairCurrent = null;
let hairMat = null;
function applyHair() {
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

createUI(state, { onChange: applyAll });

function applyAll() {
  applyFace();
  applyHair();
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
window.PSXCC = { controls, state, setAuto: (v) => (auto = v), applyAll };
