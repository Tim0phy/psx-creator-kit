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

// long back hair: tapered box with thickness, wavy mid-section and
// zig-zag bottom edge (instead of a flat cape-like sheet)
function longGeo(w, h, d, o = {}) {
  const g = new THREE.BoxGeometry(w, h, d, 1, o.segY ?? 4, 1).toNonIndexed();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i);
    const t = 0.5 - y / h; // 0 top -> 1 bottom
    const wx = 1 - (o.taper ?? 0.14) * t;
    let x = p.getX(i) * wx;
    const wave = Math.sin(t * Math.PI * (o.waves ?? 2)) * (o.wiggle ?? 0.025) * t;
    if (t > 0.15 && t < 0.92) x += wave;
    let ny = y;
    if (t > 0.9) {
      const nx = Math.abs(x) / (w * 0.5);
      ny -= nx > 0.5 ? (o.jag ?? 0.05) : (o.jag ?? 0.05) * 0.45;
    }
    p.setXYZ(i, x, ny, p.getZ(i));
  }
  g.computeVertexNormals();
  return g;
}

// ponytail/tail: rounded-ish tapered column with jagged tip, low poly
function tailGeo(w, h, d, o = {}) {
  const g = new THREE.BoxGeometry(w, h, d, 1, o.segY ?? 3, 1).toNonIndexed();
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const t = 0.5 - p.getY(i) / h;
    const taper = o.taper ?? 0.55;
    p.setXYZ(
      i,
      p.getX(i) * (1 - taper * t),
      p.getY(i) - (t > 0.85 ? (o.jag ?? 0.06) * (p.getX(i) > 0 ? 1 : 0.4) : 0),
      p.getZ(i) * (1 - taper * 0.7 * t)
    );
  }
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
  if (o.split) {
    // curtain bangs: two half-width strips with a small centre gap
    for (const s of [-1, 1]) {
      addStrip(group, mat, {
        w: 0.32, h: 0.26, sx: 3, sy: 1, jag: 0.04,
        x: s * 0.18, y: 0.26, z: o.bangsZ ?? 0.5,
      });
    }
  } else {
    addStrip(group, mat, {
      w: 0.68, h: 0.26, sx: 6, sy: 1, jag: 0.04,
      x: 0, y: 0.26, z: o.bangsZ ?? 0.5,
    });
  }
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
    // long straight with curtain bangs, smooth taper (distinct: centre part)
    capAndBangs(g, m, { split: true });
    sideLock(g, m, -1, { h: 1.2, y: -0.38, w: 0.26, z: 0.02 });
    sideLock(g, m, 1, { h: 1.2, y: -0.38, w: 0.26, z: 0.02 });
    const back = new THREE.Mesh(
      longGeo(0.74, 1.6, 0.15, { taper: 0.24, wiggle: 0.03 }), m
    );
    back.position.set(0, -0.58, -0.5);
    g.add(back);
  },
  hair_03(g, m) {
    // twin tails: cap + bangs + short sides + two tapered tails anchored inside the cap
    capAndBangs(g, m);
    sideLock(g, m, -1);
    sideLock(g, m, 1);
    for (const s of [-1, 1]) {
      const tail = new THREE.Mesh(tailGeo(0.42, 0.8, 0.22), m);
      tail.position.set(s * 0.52, -0.02, -0.24);
      tail.rotation.set(-0.1, -s * 0.55, s * 0.32);
      g.add(tail);
    }
  },
  hair_04(g, m) {
    // side ponytail: cap + bangs + short sides + one big side tail
    capAndBangs(g, m);
    sideLock(g, m, -1);
    sideLock(g, m, 1);
    const tail = new THREE.Mesh(tailGeo(0.52, 0.95, 0.26, { jag: 0.07 }), m);
    tail.position.set(0.48, -0.14, -0.2);
    tail.rotation.set(-0.15, 0, 0.3);
    g.add(tail);
  },
  hair_05(g, m) {
    // bun: cap low + bangs + bun at back top
    capAndBangs(g, m);
    const bun = new THREE.Mesh(
      roundedBox(0.36, 0.3, 0.3, 1, 1, 1, 0.17, 0.55), m
    );
    bun.position.set(0, 0.44, -0.42);
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
    // hime cut: cap + straight bangs + long side locks + jagged blunt back
    capAndBangs(g, m);
    sideLock(g, m, -1, { h: 1.3, y: -0.42, w: 0.26 });
    sideLock(g, m, 1, { h: 1.3, y: -0.42, w: 0.26 });
    const back = new THREE.Mesh(
      longGeo(0.78, 1.8, 0.17, { jag: 0.07, taper: 0.18, wiggle: 0.012 }), m
    );
    back.position.set(0, -0.66, -0.5);
    g.add(back);
  },
  hair_08(g, m) {
    // short pixie: low cap, jagged edge all around, swept bangs
    capAndBangs(g, m, { bangsZ: 0.35 });
    sideLock(g, m, -1, { h: 0.3, y: 0.1 });
    sideLock(g, m, 1, { h: 0.3, y: 0.1 });
  },
  hair_09(g, m) {
    // low ponytail: cap + bangs + short back + low hanging tail rooted inside
    capAndBangs(g, m);
    addStrip(g, m, { w: 0.84, h: 0.44, x: 0, y: -0.02, z: -0.45 });
    const tail = new THREE.Mesh(tailGeo(0.38, 0.85, 0.22), m);
    tail.position.set(0, -0.48, -0.44);
    tail.rotation.x = -0.14;
    g.add(tail);
  },
  hair_10(g, m) {
    // shoulder length with bangs: cap + bangs + skirt to shoulders
    capAndBangs(g, m);
    const back = new THREE.Mesh(longGeo(0.88, 0.95, 0.16, { waves: 1, wiggle: 0.015 }), m);
    back.position.set(0, -0.28, -0.42);
    g.add(back);
    sideLock(g, m, -1, { h: 0.9, y: -0.25 });
    sideLock(g, m, 1, { h: 0.9, y: -0.25 });
  },
  hair_11(g, m) {
    // half-up long: cap + bangs + crown puff + long back
    capAndBangs(g, m);
    const puff = new THREE.Mesh(tailGeo(0.5, 0.34, 0.24, { taper: 0.25 }), m);
    puff.position.set(0, 0.44, -0.44);
    g.add(puff);
    const back = new THREE.Mesh(
      longGeo(0.74, 1.7, 0.15, { jag: 0.06, taper: 0.22, segY: 3 }), m
    );
    back.position.set(0, -0.6, -0.5);
    g.add(back);
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
