import * as THREE from "three";
import "./style.css";
import { createPSXRenderer, makePSXMaterial } from "./psxRenderer.js";
import { createCharacter } from "./character.js";
import { createControls } from "./controls.js";

// M1: PSX renderer + base chibi body + turntable rotation.
const canvas = document.getElementById("view");
const { render } = createPSXRenderer(canvas);

const scene = new THREE.Scene();
scene.background = null;
const camera = new THREE.PerspectiveCamera(42, 480 / 360, 0.1, 50);
camera.position.set(0, 1.02, 3.35);
camera.lookAt(0, 0.98, 0);

// neutral ground disc so rotation is visible (kept minimal)
const ground = new THREE.Mesh(
  new THREE.CircleGeometry(1.4, 10),
  makePSXMaterial("#e8d8a0", { gradient: 0 })
);
ground.rotation.x = -Math.PI / 2;

const character = createCharacter();
scene.add(ground, character.root);

let auto = true;
const controls = createControls({
  getAuto: () => auto,
  setAuto: (v) => (auto = v),
});
controls.addYaw((y) => (character.root.rotation.y = y));

const clock = new THREE.Clock();
function tick() {
  const dt = clock.getDelta();
  if (auto) {
    controls.yaw += dt * 0.7;
  }
  render(scene, camera);
  requestAnimationFrame(tick);
}
tick();
