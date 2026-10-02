import * as THREE from "three";
import { bx } from "./geo.js";
import { taperBox } from "../character.js";

// bag slot builders, anchor_bag space (world origin (0, 1.0, 0.05)).
// Straps are overlapping segments whose ends bury inside the bag / head rim:
// a front run (bag -> chest -> behind the jaw) plus a back run (behind the
// neck -> across the back -> into the bag) so every strap reads as a closed
// loop worn around the body.
// Front strap plane world z 0.20-0.21 (clears chest 0.16 / sleeves 0.165-0.19);
// back strap plane world z -0.21 (clears tee back 0.17, hidden under jackets).

const UP = new THREE.Vector3(0, 1, 0);
const BACK_Z = -0.26; // builder z = world -0.21

// straight strap segment between two points (builder space)
function strap(g, m, x1, y1, z1, x2, y2, z2) {
  const dir = new THREE.Vector3(x2 - x1, y2 - y1, z2 - z1);
  const seg = bx(g, m, 0.05, dir.length() + 0.04, 0.05,
    (x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
  seg.quaternion.setFromUnitVectors(UP, dir.normalize());
}

export const BAG_BUILDER = {
  // elongated pouch tucked under the right arm (top edge grazes the arm
  // underside) + flap + zip + buckle + closed crossbody strap loop
  acc_baguette_bag(g, m) {
    const body = new THREE.Mesh(taperBox(0.44, 0.24, 0.16, 0.46, 0.36), m);
    body.position.set(0.3, -0.25, 0.14); // world (0.30, 0.75, 0.19)
    body.rotation.z = 0.06;
    g.add(body);
    bx(g, m, 0.4, 0.1, 0.18, 0.3, -0.165, 0.14);  // flap wraps the body top
    bx(g, m, 0.3, 0.03, 0.02, 0.3, -0.215, 0.25); // zip on the flap front
    bx(g, m, 0.06, 0.08, 0.06, 0.09, -0.14, 0.14); // buckle at the strap entry
    strap(g, m, 0.13, -0.18, 0.15, -0.12, 0.07, 0.15); // bag top -> chest
    strap(g, m, -0.12, 0.07, 0.15, -0.26, 0.21, 0.15); // -> left shoulder
    strap(g, m, -0.22, 0.16, BACK_Z, -0.3, 0, BACK_Z); // behind the neck
    strap(g, m, -0.3, 0, BACK_Z, 0.3, -0.2, BACK_Z);   // across the back
    strap(g, m, 0.3, -0.2, BACK_Z, 0.4, -0.25, 0.08);  // -> into the bag
  },
  // trapezoid satchel hanging at the front-right hip + flap + clasp + closed
  // strap loop over the right shoulder
  acc_shoulder_bag(g, m) {
    const body = new THREE.Mesh(taperBox(0.3, 0.22, 0.16, 0.32, 0.26), m);
    body.position.set(0.4, -0.34, 0.2); // world (0.40, 0.66, 0.25)
    g.add(body);
    bx(g, m, 0.32, 0.1, 0.17, 0.4, -0.265, 0.2);  // flap over the body top
    bx(g, m, 0.07, 0.06, 0.03, 0.4, -0.32, 0.29); // clasp on the flap front
    strap(g, m, 0.48, -0.23, 0.16, 0.4, 0.03, 0.16);  // bag top -> chest
    strap(g, m, 0.4, 0.03, 0.16, 0.26, 0.16, 0.16);   // -> right shoulder
    strap(g, m, 0.2, 0.17, BACK_Z, 0.3, -0.18, BACK_Z); // behind the neck
    strap(g, m, 0.3, -0.18, BACK_Z, 0.42, -0.38, 0.14); // -> into the bag
  },
};
