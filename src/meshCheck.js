// M9: mesh analysis for the 3D-print report. Operates on baked WORLD-space
// vertex data (the print pipeline bakes transforms before calling this):
//   - weld vertices by position to find the true wireframe
//   - shells = connected components over shared edges
//   - open/boundary edges = edges with exactly 1 triangle
//   - non-manifold edges = edges with 3+ triangles
//   - winding = ratio of consistently oriented neighbouring triangle pairs
//   - per-shell signed volume -> flipped shell detection (negative volume)
//   - overlap list = axis-aligned bounding box pairs of the shells
// Honesty rules: overlapping shells are ALLOWED and listed; nothing here
// claims printability, it only measures.
// Weld precision: the printed OBJ file carries 4-decimal mm text, so the
// report must weld in the SAME 1e-4 buckets — measuring the delivered
// topology, not a pre-rounding fiction (ear-seam edges exist only at
// 1e-5 precision; at 1e-5 the same file reported 8 phantom open edges).

const KEY = 1e4;
function pk(x, y, z) {
  return `${Math.round(x * KEY)}|${Math.round(y * KEY)}|${Math.round(z * KEY)}`;
}

// meshes: [{ positions: Float32Array (world), colors? }]
export function analyseMeshes(meshes) {
  // merge all pieces into one vertex soup for a single report topology
  let total = 0;
  for (const m of meshes) total += m.positions.length / 3;
  const pos = new Float32Array(total * 3);
  let off = 0;
  for (const m of meshes) {
    pos.set(m.positions, off);
    off += m.positions.length;
  }
  const triCount = total / 3;

  // weld
  const weld = new Map(); // key -> new index
  const wIdx = new Uint32Array(triCount * 3);
  // welded vertex positions (id -> xyz): the raw soup cannot be indexed by
  // welded id (a welded id numbers the FIRST occurrence of its key, not the
  // corner carrying it — unit-cube volumes came out 2 instead of 6)
  const wPos = new Float32Array(triCount * 3);
  for (let t = 0; t < triCount * 3; t++) {
    const k = pk(pos[t * 3], pos[t * 3 + 1], pos[t * 3 + 2]);
    let i = weld.get(k);
    if (i === undefined) { i = weld.size; weld.set(k, i); }
    wIdx[t] = i;
    wPos[i * 3] = pos[t * 3];
    wPos[i * 3 + 1] = pos[t * 3 + 1];
    wPos[i * 3 + 2] = pos[t * 3 + 2];
  }
  const wCount = weld.size;

  // edges
  const edgeMap = new Map(); // a|b -> { count, tris: [t], flip: n }
  for (let t = 0; t < triCount; t++) {
    const a = wIdx[t * 3], b = wIdx[t * 3 + 1], c = wIdx[t * 3 + 2];
    for (const [p, q] of [[a, b], [b, c], [c, a]]) {
      // check orientation consistency: p->q must be matched by q->p on the
      // neighbouring triangle (two triangles on one edge)
      const k = p < q ? `${p}<${q}` : `${q}<${p}`;
      let e = edgeMap.get(k);
      if (!e) { e = { count: 0, flip: 0, tris: [] }; edgeMap.set(k, e); }
      e.count++;
      e.tris.push(t);
      e.flip += p < q ? 1 : -1;
    }
  }

  let openEdges = 0, nonManifoldEdges = 0, consistent = 0, totalShared = 0;
  for (const e of edgeMap.values()) {
    if (e.count === 1) openEdges++;
    else if (e.count > 2) nonManifoldEdges++;
    else {
      totalShared++;
      // consistent pairs walk the shared edge in OPPOSITE directions, so
      // flip (CW-ends minus CCW-ends) cancels to 0 (verified on a plain box)
      if (e.flip === 0) consistent++;
    }
  }

  // shells: BFS over triangles sharing an edge
  const triEdges = new Map();
  for (const [k, e] of edgeMap) for (const t of e.tris) {
    if (!triEdges.has(t)) triEdges.set(t, []);
    triEdges.get(t).push(e);
  }
  const seen = new Uint8Array(triCount);
  const shells = []; // { tris, volume, bbox }
  for (let t = 0; t < triCount; t++) {
    if (seen[t]) continue;
    let frontier = [t];
    seen[t] = 1;
    const comp = [];
    while (frontier.length) {
      const next = [];
      for (const ct of frontier) {
        comp.push(ct);
        for (const e of triEdges.get(ct) ?? []) {
          for (const nb of e.tris) {
            if (!seen[nb]) { seen[nb] = 1; next.push(nb); }
          }
        }
      }
      frontier = next;
    }
    shells.push(comp);
  }

  const v0 = null; // (weld indices wIdx over `pos` are all we need below)
  void v0;

  const shellReports = [];
  for (const comp of shells) {
    let vol = 0;
    const bb = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
    for (const t of comp) {
      const a = wIdx[t * 3] * 3, b = wIdx[t * 3 + 1] * 3, c = wIdx[t * 3 + 2] * 3;
      vol += (
        wPos[a] * (wPos[b + 1] * wPos[c + 2] - wPos[c + 1] * wPos[b + 2])
        - wPos[b] * (wPos[a + 1] * wPos[c + 2] - wPos[c + 1] * wPos[a + 2])
        + wPos[c] * (wPos[a + 1] * wPos[b + 2] - wPos[b + 1] * wPos[a + 2])
      );
    }
    for (const t of comp) for (let k = 0; k < 3; k++) {
      const p = wIdx[t * 3 + k] * 3;
      bb.x0 = Math.min(bb.x0, wPos[p]); bb.y0 = Math.min(bb.y0, wPos[p + 1]); bb.z0 = Math.min(bb.z0, wPos[p + 2]);
      bb.x1 = Math.max(bb.x1, wPos[p]); bb.y1 = Math.max(bb.y1, wPos[p + 1]); bb.z1 = Math.max(bb.z1, wPos[p + 2]);
    }
    shellReports.push({
      tris: comp.length,
      // positive when outward-facing (right-handed with +Y up)
      openVolume: vol, flipped: vol < 0,
      bbox: bb,
    });
  }

  // overlap pairs between shells: two shells whose AABBs intersect (overlaps
  // are allowed and must be listed)
  const overlaps = [];
  for (let i = 0; i < shellReports.length && overlaps.length < 12; i++)
    for (let j = i + 1; j < shellReports.length && overlaps.length < 12; j++) {
      const a = shellReports[i].bbox, b = shellReports[j].bbox;
      if (a.x0 <= b.x1 && b.x0 <= a.x1 && a.y0 <= b.y1 && b.y0 <= a.y1 && a.z0 <= b.z1 && b.z0 <= a.z1)
        overlaps.push({ a: i, b: j });
    }

  const bbAll = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (let t = 0; t < triCount * 3; t++) {
    bbAll.x0 = Math.min(bbAll.x0, pos[t * 3]); bbAll.x1 = Math.max(bbAll.x1, pos[t * 3]);
    bbAll.y0 = Math.min(bbAll.y0, pos[t * 3 + 1]); bbAll.y1 = Math.max(bbAll.y1, pos[t * 3 + 1]);
    bbAll.z0 = Math.min(bbAll.z0, pos[t * 3 + 2]); bbAll.z1 = Math.max(bbAll.z1, pos[t * 3 + 2]);
  }

  return {
    triCount, verts: wCount,
    shells: shellReports.length,
    shellDetail: shellReports,
    openEdges, nonManifoldEdges,
    winding: totalShared ? consistent / totalShared : 1,
    flippedShells: shellReports.filter((s) => s.flipped).length,
    overlaps,
    bbox: bbAll,
  };
}
