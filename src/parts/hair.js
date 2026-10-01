import * as THREE from "three";
import { makePSXMaterial } from "../psxRenderer.js";

// M3 hair: flat double-sided "paper" strips with jagged lower edges,
// flat shading, vertex gradient via the shared PSX material.
// Each builder returns a group whose origin is the head centre (y=1.48).

function stripGeo(w, h, sx, sy, jag = 0, taper = 0) {
  const pos = [];
  for (let r = 0; r <= sy; r++) {
    const t = r / sy;
    const wx = t > 0 ? (1 - taper * t) : 1;
    for (let c = 0; c <= sx; c++) {
      const x = ((c / sx - 0.5) * w) * wx;
      const y = (0.5 - t) * h - (r === sy && c % 2 === 1 ? jag : 0);
      pos.push(x, y, 0);
    }
  }
  const idx = [];
  for (let r = 0; r < sy; r++)
    for (let c = 0; c < sx; c++) {
      const a = r * (sx + 1) + c, b = a + 1, d = a + sx + 1, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return g.toNonIndexed();
}

function roundedBox(w, h, d, segX, segY, segZ, r, s) {
  const g = new THREE.BoxGeometry(w, h, d, segX, segY, segZ).toNonIndexed();
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i), p.getY(i), p.getZ(i));
    const q = v.clone().normalize().multiplyScalar(r);
    p.setXYZ(
      i,
      p.getX(i) * (1 - s) + q.x * s,
      p.getY(i) * (1 - s) + q.y * s,
      p.getZ(i) * (1 - s) + q.z * s
    );
  }
  g.computeVertexNormals();
  return g;
}

// hair cap: rounded shell slightly larger than the head, front face opened
// below the fringe line (|cx| < openW) so the face stays visible
function capGeo(w, h, d, openY = 0.26, openW = 0.3) {
  const src = roundedBox(w, h, d, 3, 3, 1, 0.5, 0.38);
  const p = src.attributes.position;
  const n = src.attributes.normal;
  const keep = [];
  for (let t = 0; t < p.count; t += 3) {
    let cy = 0, cx = 0;
    for (let k = 0; k < 3; k++) { cy += p.getY(t + k); cx += p.getX(t + k); }
    cy /= 3; cx /= 3;
    const opening = n.getZ(t) > 0.4 && cy < openY && Math.abs(cx) < openW;
    if (!opening) for (let k = 0; k < 3; k++) keep.push(p.getX(t+k), p.getY(t+k), p.getZ(t+k));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(keep, 3));
  g.computeVertexNormals();
  return g;
}

function addStrip(group, mat, o) {
  const m = new THREE.Mesh(
    stripGeo(o.w, o.h, o.sx ?? 4, o.sy ?? 2, o.jag ?? 0.04, o.taper ?? 0),
    mat
  );
  m.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  if (o.ry) m.rotation.y = o.ry;
  if (o.rx) m.rotation.x = o.rx;
  if (o.rz) m.rotation.z = o.rz;
  group.add(m);
}

function capAndBangs(group, mat, o = {}) {
  const cap = new THREE.Mesh(capGeo(0.95, 0.72, 0.85, 0.02, 0.42), mat);
  cap.position.y = 0.07;
  group.add(cap);
  addStrip(group, mat, {
    w: 0.68, h: 0.26, sx: 6, sy: 1, jag: 0.04,
    x: 0, y: 0.26, z: o.bangsZ ?? 0.5,
  });
}

// side lock hanging beside the face, plane angled so it reads from the front
function sideLock(group, mat, s, o = {}) {
  addStrip(group, mat, {
    w: o.w ?? 0.32, h: o.h ?? 0.5, sx: o.sx ?? 3, sy: o.sy ?? 2,
    jag: o.jag ?? 0.04, taper: o.taper ?? 0,
    x: s * (o.x ?? 0.44), y: o.y ?? -0.04, z: o.z ?? 0.1,
    ry: s * -0.55,
  });
}

const HAIR_BUILDER = {
  hair_01(g, m) {
    // short bob: cap + bangs + short side/back skirt
    capAndBangs(g, m);
    sideLock(g, m, -1);
    sideLock(g, m, 1);
    addStrip(g, m, { w: 0.84, h: 0.5, x: 0, z: -0.45 });
  },
  hair_02(g, m) {
    // long straight with side strips
    capAndBangs(g, m);
    sideLock(g, m, -1, { h: 1.6, y: -0.55, w: 0.34 });
    sideLock(g, m, 1, { h: 1.6, y: -0.55, w: 0.34 });
    addStrip(g, m, { w: 0.86, h: 1.6, x: 0, y: -0.55, z: -0.46, sx: 6 });
  },
  hair_03(g, m) {
    // twin tails: cap + bangs + short sides + two tapered tails
    capAndBangs(g, m);
    sideLock(g, m, -1);
    sideLock(g, m, 1);
    for (const s of [-1, 1]) {
      addStrip(g, m, {
        w: 0.4, h: 0.72, sx: 3, sy: 3, jag: 0.06, taper: 0.42,
        x: s * 0.6, y: -0.1, z: -0.22, ry: -s * 0.55, rz: s * 0.28,
      });
    }
  },
  hair_04(g, m) {
    // side ponytail: cap + bangs + short sides + one big side tail
    capAndBangs(g, m);
    sideLock(g, m, -1);
    sideLock(g, m, 1);
    addStrip(g, m, {
      w: 0.5, h: 0.85, sx: 4, sy: 3, jag: 0.07, taper: 0.5,
      x: 0.6, y: -0.3, z: -0.18, rx: -0.18, rz: 0.3,
    });
  },
  hair_05(g, m) {
    // bun: cap low + bangs + bun at back top
    capAndBangs(g, m);
    const bun = new THREE.Mesh(
      roundedBox(0.36, 0.3, 0.3, 1, 1, 1, 0.17, 0.55), m
    );
    bun.position.set(0, 0.5, -0.5);
    g.add(bun);
  },
  hair_06(g, m) {
    // medium wavy layers: cap + bangs + two-layer jagged skirt
    capAndBangs(g, m);
    for (let i = 0; i < 2; i++) {
      addStrip(g, m, { w: 0.9 - i * 0.04, h: 0.55 + i * 0.18, sx: 5, sy: 2, jag: 0.06,
        x: 0, y: -0.1 - i * 0.05, z: -0.45 + i * 0.09 });
    }
    sideLock(g, m, -1, { h: 0.66, jag: 0.05, y: -0.16 });
    sideLock(g, m, 1, { h: 0.66, jag: 0.05, y: -0.16 });
  },
  hair_07(g, m) {
    // long hime cut: cap + bangs + long side locks framing the face
    capAndBangs(g, m);
    sideLock(g, m, -1, { h: 1.75, y: -0.62, w: 0.3 });
    sideLock(g, m, 1, { h: 1.75, y: -0.62, w: 0.3 });
    addStrip(g, m, { w: 0.88, h: 1.8, x: 0, y: -0.66, z: -0.46, sx: 5 });
  },
  hair_08(g, m) {
    // short pixie: low cap, jagged edge all around, swept bangs
    capAndBangs(g, m, { bangsZ: 0.35 });
    sideLock(g, m, -1, { h: 0.3, y: 0.1 });
    sideLock(g, m, 1, { h: 0.3, y: 0.1 });
  },
  hair_09(g, m) {
    // low ponytail: cap + bangs + short back + low hanging tail
    capAndBangs(g, m);
    addStrip(g, m, { w: 0.84, h: 0.4, x: 0, z: -0.45 });
    addStrip(g, m, { w: 0.36, h: 0.66, sx: 3, sy: 3, jag: 0.05, taper: 0.4,
      x: 0, y: -0.72, z: -0.55, rx: -0.12 });
  },
  hair_10(g, m) {
    // shoulder length with bangs: cap + bangs + skirt to shoulders
    capAndBangs(g, m);
    addStrip(g, m, { w: 0.88, h: 0.9, sx: 5, sy: 2, jag: 0.06, x: 0, y: -0.25, z: -0.45 });
    sideLock(g, m, -1, { h: 0.9, y: -0.25 });
    sideLock(g, m, 1, { h: 0.9, y: -0.25 });
  },
  hair_11(g, m) {
    // half-up long: cap + bangs + crown puff + long back
    capAndBangs(g, m);
    addStrip(g, m, { w: 0.5, h: 0.3, sx: 3, jag: 0.05, x: 0, y: 0.5, z: -0.55 });
    addStrip(g, m, { w: 0.86, h: 1.7, sx: 5, sy: 3, jag: 0.06, x: 0, y: -0.62, z: -0.46 });
    sideLock(g, m, -1, { h: 0.6, y: -0.1 });
    sideLock(g, m, 1, { h: 0.6, y: -0.1 });
  },
};

export const HAIR_IDS = Object.keys(HAIR_BUILDER);

export function createHair(id, colorHex) {
  const group = new THREE.Group();
  if (!HAIR_BUILDER[id]) return { group, mat: null };
  const mat = makePSXMaterial(colorHex, {
    side: THREE.DoubleSide, gradient: 0.2, ambient: 0.85, diffuse: 0.1,
  });
  HAIR_BUILDER[id](group, mat);

  let tris = 0;
  group.traverse((o) => {
    if (o.isMesh) {
      o.geometry.computeBoundingSphere();
      tris += o.geometry.attributes.position.count / 3;
    }
  });
  console.log(`[psxcc] ${id}: ${tris} tris (max 150)`);
  return { group, mat };
}
