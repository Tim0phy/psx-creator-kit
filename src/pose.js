import * as THREE from "three";
import { RIG } from "./character.js";
import { POSE_PRESETS } from "./catalog.js";

// M6.5 pose system: data model + joint application, no skinning / physics.
// state.pose = { preset: "pose_default"|..., custom: null|{angles...} };
// preset != custom -> the named catalog preset is the pose; "custom" holds
// absolute slider angles (seeded from the last preset so the baseline stays).
// All angles are degrees. Rotations use a fixed per-joint order ('ZXY'
// shoulder/thigh, single-axis elbow/kneck/knee) and are hard-clamped.

const D2R = Math.PI / 180;

export const LIMITS = {
  tilt: [-25, 25],        // root lean forward/back
  waistTwist: [-35, 35],  // waist Y twist
  headTurn: [-40, 40],    // neck/head Y turn
  drop: [0, 0.42],        // internal: sit offset applied to the hips joint (m)
  arm: { raise: [-20, 170], forward: [-60, 60], twist: [-45, 45], elbow: [0, 120] },
  leg: { spread: [-10, 35], forward: [-40, 60], knee: [0, 90] },
};

const cl = (v, lim) =>
  Math.min(lim[1], Math.max(lim[0], Number.isFinite(+v) ? +v : 0));

export function normalizeAngles(src = {}) {
  const s = src && typeof src === "object" ? src : {};
  const arm = (a = {}) => ({
    raise: cl(a.raise, LIMITS.arm.raise),
    forward: cl(a.forward, LIMITS.arm.forward),
    twist: cl(a.twist, LIMITS.arm.twist),
    elbow: cl(a.elbow, LIMITS.arm.elbow),
  });
  const leg = (a = {}) => ({
    spread: cl(a.spread, LIMITS.leg.spread),
    forward: cl(a.forward, LIMITS.leg.forward),
    knee: cl(a.knee, LIMITS.leg.knee),
  });
  return {
    tilt: cl(s.tilt, LIMITS.tilt),
    waistTwist: cl(s.waistTwist, LIMITS.waistTwist),
    headTurn: cl(s.headTurn, LIMITS.headTurn),
    armL: arm(s.armL), armR: arm(s.armR),
    legL: leg(s.legL), legR: leg(s.legR),
    drop: cl(s.drop, LIMITS.drop),
  };
}

const cloneAngles = (a) => ({
  tilt: a.tilt, waistTwist: a.waistTwist, headTurn: a.headTurn, drop: a.drop,
  armL: { ...a.armL }, armR: { ...a.armR },
  legL: { ...a.legL }, legR: { ...a.legR },
});

const lerpAngles = (a, b, t) => {
  const L = (x, y) => x + (y - x) * t;
  return {
    tilt: L(a.tilt, b.tilt), waistTwist: L(a.waistTwist, b.waistTwist),
    headTurn: L(a.headTurn, b.headTurn), drop: L(a.drop, b.drop),
    armL: {
      raise: L(a.armL.raise, b.armL.raise), forward: L(a.armL.forward, b.armL.forward),
      twist: L(a.armL.twist, b.armL.twist), elbow: L(a.armL.elbow, b.armL.elbow),
    },
    armR: {
      raise: L(a.armR.raise, b.armR.raise), forward: L(a.armR.forward, b.armR.forward),
      twist: L(a.armR.twist, b.armR.twist), elbow: L(a.armR.elbow, b.armR.elbow),
    },
    legL: {
      spread: L(a.legL.spread, b.legL.spread), forward: L(a.legL.forward, b.legL.forward),
      knee: L(a.legL.knee, b.legL.knee),
    },
    legR: {
      spread: L(a.legR.spread, b.legR.spread), forward: L(a.legR.forward, b.legR.forward),
      knee: L(a.legR.knee, b.legR.knee),
    },
  };
};

const REST_ANGLES = normalizeAngles({});
const ANIM_S = 0.25;   // preset-switch interpolation length
const STEP_FPS = 13;   // 12-15 fps stepped sampling (PSX feel)

// cloth piece tag -> joint name (parts/* set userData.clothPart)
const PART_JOINT = {
  hips: "hips", waist: "waist",
  shoulderL: "shoulderL", shoulderR: "shoulderR",
  thighL: "thighL", thighR: "thighR",
  kneeL: "kneeL", kneeR: "kneeR",
  footL: "footL", footR: "footR",
};

let singleton = null;
export const getPoseEngine = () => singleton;

class PoseEngine {
  constructor(state) {
    this.state = state;
    this.ch = null;
    this.current = normalizeAngles();  // pose currently applied
    this.baseline = normalizeAngles(); // last preset (slider reset-dot source)
    this.from = normalizeAngles();
    this.target = normalizeAngles();
    this.animT = 0;
    this.animating = false;
    this.hairLong = false;
    this.onChange = null;              // UI hook (Pose panel re-sync)
    this.pieces = new Map(); // slot -> pieces redistributed onto joints
  }

  setCharacter(ch) {
    this.ch = ch;
    this.applyPose(this.current);
  }

  presetAngles(id) {
    const def = POSE_PRESETS.find((p) => p.id === id);
    return normalizeAngles(def?.angles ?? {});
  }

  requested() {
    const sel = this.state.pose ?? { preset: "pose_default" };
    if (sel.preset === "custom") return normalizeAngles(sel.custom ?? {});
    return this.presetAngles(sel.preset);
  }

  snapshot() { return cloneAngles(this.current); }

  // UI hook after any state.pose mutation (pick preset / slider / reset)
  sync({ animate = true } = {}) {
    if (!this.ch) return;
    const sel = this.state.pose ?? {};
    const safe = this.solveClamp(this.requested());
    if (sel.preset !== "custom") this.baseline = safe;
    if (animate) {
      this.from = cloneAngles(this.current);
      this.target = safe;
      this.animT = 0;
      this.animating = true;
    } else {
      this.current = safe;
      this.applyPose(this.current);
    }
    // pose changed through any path (preset pick / RANDOM / RESET / API):
    // let the open Pose panel re-sync its thumbs + slider readouts
    if (this.onChange) this.onChange();
  }

  update(dt) {
    if (!this.animating) return;
    this.animT = Math.min(1, this.animT + dt / ANIM_S);
    const stepped = Math.floor(this.animT * STEP_FPS) / STEP_FPS;
    this.current = lerpAngles(this.from, this.target, stepped);
    this.applyPose(this.current);
    if (this.animT >= 1) this.animating = false;
  }

  // ---- joint application (fixed order, all clamped upstream) ----------------
  applyPose(a) {
    const ch = this.ch;
    if (!ch) return;
    const J = ch.joints;
    ch.root.rotation.x = a.tilt * D2R;
    J.hips.position.y = RIG.hipsY - a.drop;
    J.waist.rotation.y = a.waistTwist * D2R;
    J.neck.rotation.y = a.headTurn * D2R;
    this.applyArm(J, a.armL, -1);
    this.applyArm(J, a.armR, 1);
    this.applyLeg(J, a.legL, -1);
    this.applyLeg(J, a.legR, 1);
    this.applyFlare(Math.max(0, a.legL.spread, a.legR.spread));
    // long hair stays behind raised arms: pose-reactive depth offset (rest 0)
    const up = Math.max(a.armL.raise, a.armR.raise, 0);
    const t = Math.min(1, Math.max(0, (up - 50) / 120));
    ch.hairAnchor.position.z = this.hairLong ? -0.05 * t : 0;
  }

  applyArm(J, A, side) {
    const s = side < 0 ? "L" : "R";
    const sh = J["shoulder" + s], el = J["elbow" + s];
    sh.rotation.z = side * (RIG.armRest + A.raise * D2R);
    sh.rotation.x = -A.forward * D2R;
    sh.rotation.y = A.twist * D2R;
    // elbow/wrist fold: bend INWARD in the shoulder frame's coronal plane
    // (inward achieves hands-on-hips, waves, Salutes and fist pumps alike)
    el.rotation.z = -side * A.elbow * D2R;
  }

  applyLeg(J, L, side) {
    const s = side < 0 ? "L" : "R";
    const th = J["thigh" + s], kn = J["knee" + s], ft = J["foot" + s];
    th.rotation.z = side * L.spread * D2R;
    th.rotation.x = -L.forward * D2R;
    kn.rotation.x = L.knee * D2R;
    // no ankle slider: keep the foot flat (ground-parallel) by counter-
    // rotating the ankle pivot against thigh tilt + knee fold
    ft.rotation.x = (L.forward - L.knee) * D2R;
  }

  // skirts/hips shells widen slightly in x&z, pant tubes in x (spec E);
  // leg forward lean drapes the same way as spread
  applyFlare(spread) {
    const ch = this.ch;
    if (!ch) return;
    const f = Math.max(
      0, spread, Math.abs(this.current.legL.forward), Math.abs(this.current.legR.forward),
    );
    const s1 = 1 + 0.0028 * f;
    const s2 = 1 + 0.0016 * f;
    ch.root.traverse((o) => {
      const fl = o.userData?.flare;
      if (!fl) return;
      if (fl === "xz") { o.scale.x = s1; o.scale.z = s1; }
      else if (fl === "x") o.scale.x = s2;
    });
  }

  // ---- garment joints -------------------------------------------------------
  // Called after every item mount, at REST: tagged pieces (and the group
  // itself, if tagged) are re-parented onto their joints with world
  // transforms preserved -> rest pixels identical, pose follows limbs.
  // Previous pieces of the slot are removed from the joints first so item
  // rebuilds never leave stale shells behind.
  // Returns the joint name the group was attached to ("" = none).
  attachCloth(slot, group) {
    const ch = this.ch;
    if (!ch) return "";
    // drop this slot's previous redistribution (they live under joints now)
    for (const o of this.pieces.get(slot) ?? []) {
      if (o.parent) o.parent.remove(o);
    }
    // un-equip (group == null): pieces released above, nothing to attach
    if (!group) {
      this.pieces.delete(slot);
      return "";
    }
    // collect tagged descendants first (children re-parent out, then the
    // group itself if tagged)
    const tagged = [];
    group.traverse((o) => {
      if (o !== group && o.userData?.clothPart) tagged.push(o);
    });
    if (!tagged.length && !group.userData?.clothPart) {
      this.pieces.delete(slot);
      return "";
    }
    const prev = cloneAngles(this.current);
    this.applyPose(REST_ANGLES);
    ch.root.updateMatrixWorld(true); // attach() needs fresh matrixWorld
    for (const o of tagged) {
      const part = o.userData.clothPart;
      const j = PART_JOINT[part];
      if (!j) continue;
      ch.joints[j].attach(o);
      // sleeve containers carry the old static A-pose tilt (rz side * 0.2)
      // baked from root space; after re-parenting the shoulder joint supplies
      // that rest rotation itself, so drop the baked local one -> the sleeve
      // tilts with the joint and follows every pose change
      if (part.startsWith("shoulder")) o.rotation.set(0, 0, 0);
    }
    let attached = "";
    if (group.userData?.clothPart) {
      attached = group.userData.clothPart;
      const j = PART_JOINT[attached];
      if (j) ch.joints[j].attach(group);
      else attached = "";
    }
    this.applyPose(prev);
    this.pieces.set(slot, [...tagged, ...(attached ? [group] : [])]);
    return attached;
  }

  // ---- analytic collision guard (no physics) --------------------------------
  // Shrink the offending angles toward rest until the sampled points leave
  // the occupied volumes (measured on the real rig, poses verified safe).
  // Deterministic, a few matrix ops per call.
  solveClamp(t) {
    const a = cloneAngles(t);
    if (!this.ch) return a;
    this.applyPose(a);
    for (const key of ["armL", "armR"]) {
      if (!this.armHits(key)) continue;
      let guard = 40;
      while (guard-- > 0) {
        const A = a[key];
        A.raise += (0 - A.raise) * 0.35;
        A.forward += (0 - A.forward) * 0.35;
        A.elbow += (0 - A.elbow) * 0.35;
        this.applyPose(a);
        if (!this.armHits(key)) break;
      }
    }
    // deep knee folds stab the toe/heel into the thigh tube -> unfold
    for (const key of ["legL", "legR"]) {
      let guard = 20;
      while (guard-- > 0 && a[key].knee > 1 && this.footHits(key)) {
        a[key].knee *= 0.65;
        this.applyPose(a);
      }
    }
    // negative spread crosses the feet into each other -> close back to rest
    let guard = 20;
    while (guard-- > 0 && this.feetOverlap()
      && (a.legL.spread < -0.5 || a.legR.spread < -0.5)) {
      if (a.legL.spread < -0.5) a.legL.spread *= 0.65;
      if (a.legR.spread < -0.5) a.legR.spread *= 0.65;
      this.applyPose(a);
    }
    return a;
  }

  // palm tip + forearm mid vs head box and torso volume (waist-local)
  armHits(key) {
    const ch = this.ch, J = ch.joints;
    const elbow = J["elbow" + key.slice(3)];
    const pts = [[0, -0.23, 0], [0, -0.115, 0]].map(
      (p) => elbow.localToWorld(new THREE.Vector3(...p))
    );
    for (const p of pts) {
      const hl = J.head.worldToLocal(p.clone());
      if (Math.abs(hl.x) < 0.48 && Math.abs(hl.y) < 0.46 && Math.abs(hl.z) < 0.44)
        return true;
      const wl = J.waist.worldToLocal(p); // torso: waist/hips shell volume
      if (Math.abs(wl.x) < 0.34 && Math.abs(wl.z) < 0.19
        && wl.y > -0.42 && wl.y < 0.26) return true;
    }
    return false;
  }

  // foot toe/heel vs the thigh tube (thigh-local; the skin mesh spans y
  // -0.32..0, half-x ~0.19, half-z ~0.18) -> catches knee-90 toe stabs
  footHits(key) {
    const ch = this.ch, J = ch.joints;
    const s = key.slice(3);
    const foot = J["foot" + s], thigh = J["thigh" + s];
    for (const p of [[0, 0.03, 0.2], [0, 0.03, -0.2]]) {
      const q = thigh.worldToLocal(foot.localToWorld(new THREE.Vector3(...p)));
      if (Math.abs(q.x) < 0.22 && Math.abs(q.z) < 0.19 && q.y > -0.34 && q.y < 0.03)
        return true;
    }
    return false;
  }

  // the pair of feet boxes (about 0.42 wide each) must not overcross
  feetOverlap() {
    const ch = this.ch, J = ch.joints;
    const l = J.footL.getWorldPosition(new THREE.Vector3());
    const r = J.footR.getWorldPosition(new THREE.Vector3());
    return Math.abs(l.x - r.x) < 0.36;
  }
}

export function createPoseEngine(state) {
  singleton = new PoseEngine(state);
  return singleton;
}
