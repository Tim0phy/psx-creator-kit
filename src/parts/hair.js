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

// hair cap: rounded shell slightly larger than the head. The fringe is cut
// directly out of the cap front (no separate floating strip):
// - openY: fringe level over the forehead
// - teeth: jagged zig-zag depth (0 = blunt straight fringe)
// - swept: slanted fringe (left-right height difference)
// - partCut/partY: middle-part opening in the centre
// - sideY: how far the front sides hang down (hime wings, short male sides)
function capGeo(w, h, d, o = {}) {
  const src = roundedBox(w, h, d, 4, 4, 1, 0.5, 0.38);
  const p = src.attributes.position;
  const n = src.attributes.normal;
  const keep = [];
  const cutHeight = (cx) => {
    let y;
    if (Math.abs(cx) > (o.faceW ?? 0.34)) {
      y = o.sideY ?? -0.3; // side wings can hang lower than the face window
    } else {
      y = o.openY ?? 0.14;
      if (o.partCut && Math.abs(cx) < o.partCut) y = Math.max(y, o.partY ?? 0.18);
      if (o.swept) y -= cx * o.swept;
      if (o.teeth) y -= Math.round((cx + 1.5) * 7) % 2 ? o.teeth : 0;
      if (o.maxCut) y = Math.min(y, o.maxCut);
    }
    return y;
  };
  for (let t = 0; t < p.count; t += 3) {
    let cy = 0, cx = 0;
    for (let k = 0; k < 3; k++) { cy += p.getY(t + k); cx += p.getX(t + k); }
    cy /= 3; cx /= 3;
    const nz = n.getZ(t), nx = n.getX(t);
    let opening = nz > 0.4 && cy < cutHeight(cx);
    // short male styles: trim both sides and the back independently
    if (!opening && o.shortY != null) {
      if (Math.abs(nx) > 0.5) opening = cy < o.shortY;
      else if (nz < -0.5) opening = cy < (o.backY ?? o.shortY);
      else if (n.getY(t) < -0.5) opening = true; // no underside plate
    }
    if (!opening) for (let k = 0; k < 3; k++) {
      keep.push(p.getX(t+k), p.getY(t+k), p.getZ(t+k));
    }
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

// thin double-sided triangular spike sticking out of the cap
function spikeGeo(w, h) {
  const p = [
    -w / 2, 0, 0.045, w / 2, 0, 0.045, 0, h, 0.045,
    w / 2, 0, -0.045, -w / 2, 0, -0.045, 0, h, -0.045,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
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
  const cap = new THREE.Mesh(capGeo(o.capW ?? 0.95, o.capH ?? 0.72, o.capD ?? 0.85, o), mat);
  cap.position.y = 0.07;
  group.add(cap);
}

function spikeRing(group, mat, { count = 7, h = 0.34, w = 0.26, r = 0.36, y = 0.28, start = 2.6, end = -2.6 } = {}) {
  for (let i = 0; i < count; i++) {
    const th = start + (i / (count - 1)) * (end - start);
    const sp = new THREE.Mesh(spikeGeo(w, h), mat);
    sp.position.set(Math.sin(th) * r, y, Math.cos(th) * r);
    sp.rotation.y = -th;
    group.add(sp);
  }
}

// side lock hanging beside the face, tilted slightly back so it never
// pokes through the chin
function sideLock(group, mat, s, o = {}) {
  addStrip(group, mat, {
    w: o.w ?? 0.32, h: o.h ?? 0.5, sx: o.sx ?? 3, sy: o.sy ?? 2,
    jag: o.jag ?? 0.04, taper: o.taper ?? 0,
    x: s * (o.x ?? 0.45), y: o.y ?? -0.04, z: o.z ?? 0.04,
    ry: s * -0.5, rx: o.rx ?? -0.14,
  });
}

const HAIR_BUILDER = {
  hair_01(g, m) {
    // short bob: soft zig-zag fringe cut into the cap, rounded skirt
    capAndBangs(g, m, { openY: 0.16, teeth: 0.05, sideY: -0.3 });
    addStrip(g, m, { w: 0.84, h: 0.5, x: 0, z: -0.45, jag: 0.05 });
  },
  hair_02(g, m) {
    // long straight: centre parting (small gap) + smooth tapered back
    capAndBangs(g, m, { partCut: 0.13, partY: 0.2, sideY: -0.2 });
    sideLock(g, m, -1, { h: 1.2, y: -0.38, w: 0.26 });
    sideLock(g, m, 1, { h: 1.2, y: -0.38, w: 0.26 });
    const back = new THREE.Mesh(
      longGeo(0.74, 1.6, 0.15, { taper: 0.24, wiggle: 0.03 }), m
    );
    back.position.set(0, -0.58, -0.5);
    g.add(back);
  },
  hair_03(g, m) {
    // twin tails: blunt high fringe + tails anchored inside the cap
    capAndBangs(g, m, { openY: 0.2, sideY: -0.24 });
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
    // side ponytail: neat swept fringe, small side locks, chunky side tail
    // maxCut <= 0.18 keeps the cut off the top-front bend (no scalp holes)
    capAndBangs(g, m, { openY: 0.18, swept: 0.24, sideY: -0.2, maxCut: 0.18 });
    sideLock(g, m, -1, { w: 0.22, h: 0.36 });
    sideLock(g, m, 1, { w: 0.22, h: 0.36 });
    const tail = new THREE.Mesh(tailGeo(0.42, 0.8, 0.22, { jag: 0.08 }), m);
    tail.position.set(0.5, -0.05, -0.3);
    tail.rotation.set(-0.1, -0.55, 0.3);
    g.add(tail);
  },
  hair_05(g, m) {
    // bun: sleek straight high fringe, no jag
    capAndBangs(g, m, { openY: 0.22, sideY: -0.2 });
    const bun = new THREE.Mesh(
      roundedBox(0.36, 0.3, 0.3, 1, 1, 1, 0.17, 0.55), m
    );
    bun.position.set(0, 0.44, -0.42);
    g.add(bun);
  },
  hair_06(g, m) {
    // male spikes: short sides/back, zigzag fringe, tall crown clumps
    // swept up and back (rooster style) + two side clumps
    capAndBangs(g, m, {
      capH: 0.6, openY: 0.2, teeth: 0.1, sideY: -0.12,
      maxCut: 0.15, shortY: -0.02, backY: -0.02,
    });
    const clumps = [
      // x, y, z, rx, ry, rz, height
      [0, 0.32, 0.22, -0.05, 0, 0, 0.5],
      [-0.16, 0.35, 0.12, 0.1, 0, -0.3, 0.56],
      [0.16, 0.35, 0.12, 0.1, 0, 0.3, 0.56],
      [-0.26, 0.34, -0.04, 0.45, 0, -0.45, 0.54],
      [0.26, 0.34, -0.04, 0.45, 0, 0.45, 0.54],
      [-0.18, 0.32, -0.22, 0.75, -0.1, -0.2, 0.5],
      [0.18, 0.32, -0.22, 0.75, 0.1, 0.2, 0.5],
      [0, 0.32, -0.3, 0.9, 0, 0, 0.52],
      [-0.34, 0.26, -0.02, -0.15, -0.75, -0.65, 0.42],
      [0.34, 0.26, -0.02, -0.15, 0.75, 0.65, 0.42],
      [-0.1, 0.36, 0.24, -0.05, 0, -0.15, 0.42],
      [0.1, 0.36, 0.24, -0.05, 0, 0.15, 0.42],
    ];
    for (const [x, y, z, rx, ry, rz, h] of clumps) {
      const sp = new THREE.Mesh(spikeGeo(0.3, h), m);
      sp.position.set(x, y, z);
      sp.rotation.set(rx, ry, rz);
      g.add(sp);
    }
  },
  hair_07(g, m) {
    // hime cut: level fringe + long side wings carved from the cap + jagged back
    capAndBangs(g, m, { openY: 0.14, teeth: 0.02, sideY: -0.55 });
    const back = new THREE.Mesh(
      longGeo(0.78, 1.8, 0.17, { jag: 0.07, taper: 0.18, wiggle: 0.012 }), m
    );
    back.position.set(0, -0.66, -0.5);
    g.add(back);
  },
  hair_08(g, m) {
    // buzz cut: snug tight cap hugging the head, hairline above the brows,
    // uniform short sides and back, no extra volume
    capAndBangs(g, m, {
      capW: 0.9, capH: 0.64, capD: 0.8,
      openY: 0.24, teeth: 0.06, sideY: -0.06, maxCut: 0.16,
      shortY: -0.02, backY: -0.02,
    });
  },
  hair_09(g, m) {
    // low ponytail: neat straight fringe + short back + low tail rooted inside
    capAndBangs(g, m, { openY: 0.2, sideY: -0.2 });
    addStrip(g, m, { w: 0.84, h: 0.44, x: 0, y: -0.02, z: -0.45 });
    const tail = new THREE.Mesh(tailGeo(0.38, 0.85, 0.22), m);
    tail.position.set(0, -0.48, -0.44);
    tail.rotation.x = -0.14;
    g.add(tail);
  },
  hair_10(g, m) {
    // short male diagonal fringe: swept wedge, tight sides, short nape
    capAndBangs(g, m, {
      capH: 0.6, openY: 0.2, swept: 0.35, teeth: 0.1, sideY: -0.08,
      maxCut: 0.15, shortY: -0.02, backY: -0.12,
    });
    addStrip(g, m, { w: 0.5, h: 0.18, x: 0, y: -0.06, z: -0.44, jag: 0.03 });
  },
  hair_11(g, m) {
    // half-up long: narrow centre parting + crown puff + long back
    capAndBangs(g, m, { partCut: 0.12, partY: 0.2, sideY: -0.2 });
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
