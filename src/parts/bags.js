import * as THREE from "three";
import { bx } from "./geo.js";
import { taperBox } from "../character.js";

// bag slot builders, anchor_bag space (world origin (0, 1.0, 0.05)).
// Every strap is overlapping segments whose ends bury inside the bag top /
// head rim, so bag + strap always read as one connected object.
// Strap plane z: clears the chest front (0.16) and sleeve fronts (0.165-0.19).

// straight strap segment from (x1, y1) to (x2, y2) at fixed builder z
function strap(g, m, x1, y1, x2, y2, z) {
  const dx = x2 - x1, dy = y2 - y1;
  const seg = bx(g, m, 0.05, Math.hypot(dx, dy) + 0.04, 0.05,
    (x1 + x2) / 2, (y1 + y2) / 2, z);
  seg.rotation.z = Math.atan2(-dx, dy);
}

export const BAG_BUILDER = {
  // elongated pouch tucked under the right arm (top edge grazes the arm
  // underside) + flap + zip + buckle + crossbody strap over the left shoulder
  acc_baguette_bag(g, m) {
    const body = new THREE.Mesh(taperBox(0.44, 0.24, 0.16, 0.46, 0.36), m);
    body.position.set(0.3, -0.25, 0.14); // world (0.30, 0.75, 0.19)
    body.rotation.z = 0.06;
    g.add(body);
    bx(g, m, 0.4, 0.1, 0.18, 0.3, -0.165, 0.14);  // flap wraps the body top
    bx(g, m, 0.3, 0.03, 0.02, 0.3, -0.215, 0.25); // zip on the flap front
    bx(g, m, 0.06, 0.08, 0.06, 0.09, -0.14, 0.14); // buckle at the strap entry
    strap(g, m, 0.13, -0.18, -0.12, 0.07, 0.15); // bag top -> across chest
    strap(g, m, -0.12, 0.07, -0.26, 0.21, 0.15); // -> over the left shoulder
  },
  // trapezoid satchel hanging at the front-right hip + flap + clasp + strap
  // over the right shoulder (upper end dives behind the jaw line)
  acc_shoulder_bag(g, m) {
    const body = new THREE.Mesh(taperBox(0.3, 0.22, 0.16, 0.32, 0.26), m);
    body.position.set(0.4, -0.34, 0.2); // world (0.40, 0.66, 0.25)
    g.add(body);
    bx(g, m, 0.32, 0.1, 0.17, 0.4, -0.265, 0.2);  // flap over the body top
    bx(g, m, 0.07, 0.06, 0.03, 0.4, -0.32, 0.29); // clasp on the flap front
    strap(g, m, 0.48, -0.23, 0.4, 0.03, 0.16);  // bag top -> up the chest
    strap(g, m, 0.4, 0.03, 0.26, 0.16, 0.16);   // -> over the right shoulder
  },
};
