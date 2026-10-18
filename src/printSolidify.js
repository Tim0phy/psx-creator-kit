// M9 print OBJ: manufacture helpers that turn the creator's display
// geometry (flat face planes, zero-thickness hair strips, open
// cylinders/skirts, thin closed boxes) into solids a slicer can print.
// Language: every function eats/emits FLAT corner arrays —
//   positions: Float32Array xyz per corner (already MILLIMETRES)
//   colours:   Float32Array rgb per corner (same indexing as positions)
// Pure array math; no THREE objects, no DOM, no live-scene access.

const WELD = 1e5; // weld precision: 1e-5 mm

function weldKey(x, y, z) {
  return `${Math.round(x * WELD)}|${Math.round(y * WELD)}|${Math.round(z * WELD)}`;
}

// weld corners by position -> { pos, col, tris (welded ids), count }
export function weldSoup(positions, colours) {
  const wantCol = !!colours;
  const map = new Map();
  const p = [], c = [];
  const tris = new Uint32Array(positions.length / 3);
  for (let i = 0; i < tris.length; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    const k = weldKey(x, y, z);
    let nid = map.get(k);
    if (nid === undefined) {
      nid = map.size; map.set(k, nid);
      p.push(x, y, z);
      if (wantCol) c.push(colours[i * 3], colours[i * 3 + 1], colours[i * 3 + 2]);
    }
    tris[i] = nid;
  }
  return {
    pos: new Float32Array(p),
    col: wantCol ? new Float32Array(c) : null,
    tris, count: map.size,
  };
}

// split welded triangles into edge-connected components (shells).
// Returns an array of Uint32Array (tri ids into the welded tri space).
export function shellSplit(tris) {
  const nT = tris.length / 3;
  const edgeTris = new Map();
  for (let t = 0; t < nT; t++) {
    const a = tris[t * 3], b = tris[t * 3 + 1], c = tris[t * 3 + 2];
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const k = p < q ? `${p}<${q}` : `${q}<${p}`;
      let e = edgeTris.get(k);
      if (!e) { e = []; edgeTris.set(k, e); }
      e.push(t);
    }
  }
  const nbr = new Map();
  for (const list of edgeTris.values())
    for (const t of list) {
      let n = nbr.get(t);
      if (!n) { n = []; nbr.set(t, n); }
      n.push(...list);
    }
  const seen = new Uint8Array(nT);
  const shells = [];
  for (let t = 0; t < nT; t++) {
    if (seen[t]) continue;
    const comp = [];
    let frontier = [t];
    seen[t] = 1;
    while (frontier.length) {
      const next = [];
      for (const ct of frontier) {
        comp.push(ct);
        for (const nb of nbr.get(ct) ?? [])
          if (!seen[nb]) { seen[nb] = 1; next.push(nb); }
      }
      frontier = next;
    }
    shells.push(comp);
  }
  return shells;
}

// facts about one welded shell: boundary edges (as oriented welded-id pairs
// [a,b] where a->b follows the owning triangle's winding), non-manifold edge
// count, bbox (the SHELL's own vertices only), thin-axis extents and signed
// volume (+ = outward faces, +Y up)
export function shellFacts(pos, tris) {
  const edge = new Map();
  let nonManifold = 0;
  for (let t = 0; t < tris.length / 3; t++) {
    const a = tris[t * 3], b = tris[t * 3 + 1], c = tris[t * 3 + 2];
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      const k = p < q ? `${p}<${q}` : `${q}<${p}`;
      let e = edge.get(k);
      if (!e) { e = { count: 0, pair: [p, q] }; edge.set(k, e); }
      e.count++;
    }
  }
  const boundary = [];
  for (const e of edge.values()) {
    if (e.count === 1) boundary.push(e.pair);
    else if (e.count > 2) nonManifold++;
  }
  const bb = { x0: 1e9, y0: 1e9, z0: 1e9, x1: -1e9, y1: -1e9, z1: -1e9 };
  for (let i = 0; i < tris.length; i++) {
    const v = tris[i] * 3;
    const x = pos[v], y = pos[v + 1], z = pos[v + 2];
    if (x < bb.x0) bb.x0 = x; if (x > bb.x1) bb.x1 = x;
    if (y < bb.y0) bb.y0 = y; if (y > bb.y1) bb.y1 = y;
    if (z < bb.z0) bb.z0 = z; if (z > bb.z1) bb.z1 = z;
  }
  let vol = 0;
  for (let t = 0; t < tris.length / 3; t++) {
    const a = tris[t * 3] * 3, b = tris[t * 3 + 1] * 3, c = tris[t * 3 + 2] * 3;
    vol += (
      pos[a] * (pos[b + 1] * pos[c + 2] - pos[c + 1] * pos[b + 2])
      - pos[b] * (pos[a + 1] * pos[c + 2] - pos[c + 1] * pos[a + 2])
      + pos[c] * (pos[a + 1] * pos[b + 2] - pos[b + 1] * pos[a + 2])
    );
  }
  return {
    boundary, nonManifold, bbox: bb, volume: vol,
    extents: { x: bb.x1 - bb.x0, y: bb.y1 - bb.y0, z: bb.z1 - bb.z0 },
  };
}

// solidify an OPEN shell: duplicate the surface offset INWARD by `t`
// (opposite the averaged vertex normals), reverse the copy's winding and
// close the boundary edges with rim quads. The outer surface stays EXACTLY
// where it was; the sheet becomes an enclosed slab `t` thick.
export function solidifyShell(pos, col, tris, t, facts) {
  const nv = pos.length / 3;
  const nT = tris.length / 3;
  // averaged vertex normals from triangle crosses
  const acc = new Float32Array(nv * 3);
  for (let i = 0; i < nT; i++) {
    const a = tris[i * 3], b = tris[i * 3 + 1], c = tris[i * 3 + 2];
    const ax = pos[a * 3], ay = pos[a * 3 + 1], az = pos[a * 3 + 2];
    const nx = (pos[b * 3 + 1] - ay) * (pos[c * 3 + 2] - az) - (pos[b * 3 + 2] - az) * (pos[c * 3 + 1] - ay);
    const ny = (pos[b * 3 + 2] - az) * (pos[c * 3] - ax) - (pos[b * 3] - ax) * (pos[c * 3 + 2] - az);
    const nz = (pos[b * 3] - ax) * (pos[c * 3 + 1] - ay) - (pos[b * 3 + 1] - ay) * (pos[c * 3] - ax);
    for (const v of [a, b, c]) {
      acc[v * 3] += nx; acc[v * 3 + 1] += ny; acc[v * 3 + 2] += nz;
    }
  }
  // one vertex slot per copy in ONE array: ids 0..nv-1 outer, nv..2nv-1 inner
  const buf = new Float64Array(nv * 2 * 3);
  const bc = col ? new Float32Array(nv * 2 * 3) : null;
  for (let v = 0; v < nv; v++) {
    const dk = [acc[v * 3], acc[v * 3 + 1], acc[v * 3 + 2]];
    const len = Math.hypot(dk[0], dk[1], dk[2]) || 1;
    for (let k = 0; k < 3; k++)
      buf[(nv + v) * 3 + k] = pos[v * 3 + k] - (dk[k] / len) * t;
    for (let k = 0; k < 3; k++) buf[v * 3 + k] = pos[v * 3 + k];
    if (bc) for (let k = 0; k < 3; k++) {
      bc[v * 3 + k] = col[v * 3 + k];
      bc[(nv + v) * 3 + k] = col[v * 3 + k];
    }
  }
  const nRim = facts.boundary.length;
  const oPos = new Float32Array((nT * 2 + nRim * 2) * 9);
  const oCol = col ? new Float32Array(oPos.length) : null;
  let w = 0;
  const put = (vid) => { // vid: slots 0..2nv-1, straight into buf/bc
    for (let k = 0; k < 3; k++) oPos[w + k] = buf[vid * 3 + k];
    if (oCol) for (let k = 0; k < 3; k++) oCol[w + k] = bc[vid * 3 + k];
    w += 3;
  };
  const tri = (a, b, c) => { put(a); put(b); put(c); };
  for (let i = 0; i < nT; i++) {
    tri(tris[i * 3], tris[i * 3 + 1], tris[i * 3 + 2]);                 // outer
    tri(tris[i * 3 + 2] + nv, tris[i * 3 + 1] + nv, tris[i * 3] + nv); // inner, reversed
  }
  // rim quads. For a boundary edge a->b used by one triangle in that order
  // (patch interior lies left of a->b), quad = b, a, aInner, bInner
  // (winding verified against a concrete CCW patch example) -> 2 triangles
  for (const [a, b] of facts.boundary) {
    tri(b, a, a + nv);
    tri(b, a + nv, b + nv);
  }
  return {
    pos: oPos, col: oCol,
    corners: w / 3,
    note: `solidified (t=${t}mm)`,
  };
}

// flip a shell's triangles in place (volume read negative during manufacture)
export function rewindShell(tris) {
  const out = new Uint32Array(tris.length);
  for (let t = 0; t < tris.length / 3; t++) {
    out[t * 3] = tris[t * 3];
    out[t * 3 + 1] = tris[t * 3 + 2];
    out[t * 3 + 2] = tris[t * 3 + 1];
  }
  return out;
}

// closed shell thinnest-axis scale: about the centre of the shell's OWN
// thinnest world axis, scale that axis so the shell's extent becomes `t` mm.
// A linear axis scale maps confined boxes to confined boxes (faces stay
// planar), so the closed shell MANIFOLD is preserved. Emits ONLY this shell's
// triangles (one corner per original corner), so the appended soup stays a
// whole number of triangles — the old version returned the WHOLE piece's
// vertex array, which fed its other shells' corners into the face list.
export function thickenShell(pos, col, tris, t) {
  const facts = shellFacts(pos, tris);
  const ex = facts.extents;
  const axis = ex.x <= ex.y && ex.x <= ex.z ? 0 : (ex.y <= ex.z ? 1 : 2);
  const bb = facts.bbox;
  const ext = [ex.x, ex.y, ex.z][axis];
  const centre = axis === 0 ? (bb.x0 + bb.x1) / 2 : axis === 1 ? (bb.y0 + bb.y1) / 2 : (bb.z0 + bb.z1) / 2;
  const f = ext > 1e-9 ? t / ext : 1;
  const out = new Float32Array(tris.length * 3);
  const oCol = col ? new Float32Array(tris.length * 3) : null;
  for (let i = 0; i < tris.length; i++) {
    const v = tris[i] * 3;
    for (let k = 0; k < 3; k++) {
      const s = pos[v + k];
      out[i * 3 + k] = k === axis ? centre + (s - centre) * f : s;
      if (oCol) oCol[i * 3 + k] = col[v + k];
    }
  }
  return { pos: out, col: oCol, axis, from: ext, note: `thickened (t=${t}mm)` };
}

// barycentric lattice subdivision of ONE triangle (k^2 sub-triangles).
// p/c/uv are [ax,ay,az][r,g,b][u,v] corner triplets. Every sub-corner's
// colour = interpolated baked colour x texture sample (sampler may be null
// -> colour without texture). Emits into `out` ({ pos: [], col: [] }).
export function subdivideFaceTri(P, C, U, k, sample, out) {
  const rows = [];
  let start = 0;
  for (let j = 0; j <= k; j++) {
    rows[j] = start;
    start += k - j + 1;
  }
  const nAll = start;
  const nodes = new Float64Array(nAll * 8); // xyz rgb uv per lattice node
  for (let j = 0; j <= k; j++)
    for (let i = 0; i <= k - j; i++) {
      const s = (i + j) / k; // A weight
      const tb = j / k, tc = i / k;
      for (let d = 0; d < 3; d++) {
        nodes[(rows[j] + i) * 8 + d] = P[d] * (1 - s) + P[3 + d] * tb + P[6 + d] * tc;
        nodes[(rows[j] + i) * 8 + 3 + d] = C[d] * (1 - s) + C[3 + d] * tb + C[6 + d] * tc;
      }
      for (let d = 0; d < 2; d++) nodes[(rows[j] + i) * 8 + 6 + d] = U[d] * (1 - s) + U[2 + d] * tb + U[4 + d] * tc;
    }
  const emit = (n) => {
    for (let d = 0; d < 3; d++) out.pos.push(nodes[n * 8 + d]);
    let c = [nodes[n * 8 + 3], nodes[n * 8 + 4], nodes[n * 8 + 5]];
    if (sample) {
      const s = sample(nodes[n * 8 + 6], nodes[n * 8 + 7]);
      c = [Math.min(1, c[0] * s[0]), Math.min(1, c[1] * s[1]), Math.min(1, c[2] * s[2])];
    }
    for (let d = 0; d < 3; d++) out.col.push(c[d]);
  };
  // two triangles per lattice cell; the traversal order keeps the parent
  // (A,B,C) winding on every sub-triangle (cross-product checked at the
  // A-cell: (midAB-A)x(midAC-A) == (B-A)x(C-A))
  for (let j = 0; j < k; j++) {
    const r = rows[j], r1 = rows[j + 1];
    for (let i = 0; i <= k - j - 1; i++) emit(r + i), emit(r1 + i), emit(r + i + 1);
    for (let i = 0; i <= k - j - 2; i++) emit(r + i + 1), emit(r1 + i), emit(r1 + i + 1);
  }
}
