import * as THREE from "three";
import { makePSXMaterial } from "../psxRenderer.js";
import { PatternTexture } from "../patterns.js";

// M6 socks: striped knee socks (catalog sock_knee_stripe). Knee tubes around
// the legs, drawn under shoes and above bare skin. Sock wall half-w 0.19
// covers the leg (0.135-0.17) and tucks under any pant hem (0.3).

const SOCK_BUILDER = {
  sock_knee_stripe(g, m) {
    const h = 0.44; // y 0.16..0.6: just under the knee
    for (const side of [-1, 1]) {
      const tube = new THREE.Mesh(
        new THREE.BoxGeometry(0.38, h, 0.38).toNonIndexed(), m
      );
      tube.position.set(side * 0.19, 0.16 + h / 2, 0);
      g.add(tube);
    }
  },
};

export function createSocks(id, colors, patternName = null) {
  const group = new THREE.Group();
  const main = colors.main ?? "#ffffff";
  const sec = colors.secondary ?? "#222222";
  let mat;
  let pattern = null;
  if (patternName) {
    pattern = new PatternTexture();
    pattern.set(patternName, main, sec);
    mat = makePSXMaterial("#ffffff", { map: pattern.texture, gradient: 0.14 });
  } else {
    mat = makePSXMaterial(main, { gradient: 0.14 });
  }
  if (SOCK_BUILDER[id]) SOCK_BUILDER[id](group, mat);
  let tris = 0;
  group.traverse((o) => {
    if (o.isMesh) {
      o.geometry.computeBoundingSphere();
      tris += o.geometry.attributes.position.count / 3;
    }
  });
  if (SOCK_BUILDER[id]) console.log(`[psxcc] ${id}: ${tris} tris (max 150)`);
  return { group, mat, pattern };
}
