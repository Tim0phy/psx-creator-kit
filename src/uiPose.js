import { POSE_PRESETS } from "./catalog.js";
import { getPoseEngine, LIMITS, normalizeAngles } from "./pose.js";
import { el, pillRow } from "./uiWidgets.js";

// M6.5 Pose tab UI: 9 round preset thumbnails (64x64 offscreen, cached) in
// the left grid + manual slider groups on the right (same pixel/wood UI
// language as every other tab). Slider input switches the preset to
// "custom", seeded from the last selected preset so the baseline survives.

const ARM_FIELDS = [
  ["raise", "RAISE"], ["forward", "FWD"], ["twist", "TWIST"], ["elbow", "ELBOW"],
];
const LEG_FIELDS = [["spread", "SPREAD"], ["forward", "FWD"], ["knee", "KNEE"]];

const GROUPS = [
  {
    title: "BODY",
    fields: [["tilt", "LEAN"], ["waistTwist", "TWIST"], ["headTurn", "HEAD"]],
  },
  { title: "LEFT ARM", branch: "armL", fields: ARM_FIELDS },
  { title: "RIGHT ARM", branch: "armR", fields: ARM_FIELDS },
  { title: "LEFT LEG", branch: "legL", fields: LEG_FIELDS },
  { title: "RIGHT LEG", branch: "legR", fields: LEG_FIELDS },
];

const INK = "#38220c";
const D2R = Math.PI / 180;

// ---- cached 64x64 thumbnails (2D preview with the rig angle conventions) ---
const thumbCache = new Map();

function seg(ctx, x, y, ang, len, w, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.fillStyle = fill;
  ctx.fillRect(-w / 2, 0, w, len);
  ctx.restore();
}

// segment end point (canvas rotate: down vector (0,1) -> (-sin, cos))
const endX = (x, ang, len) => x - Math.sin(ang) * len;
const endY = (y, ang, len) => y + Math.cos(ang) * len;

function drawChibi(ctx, a) {
  // torso + head
  ctx.fillStyle = "#e06060";
  ctx.fillRect(25, 20, 14, 15); // shirt
  ctx.fillStyle = "#f5d5bf";
  ctx.fillRect(26, 9, 12, 11); // head
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.strokeRect(26, 9, 12, 11);
  ctx.fillStyle = INK;
  ctx.fillRect(29, 13, 2, 3); // eyes
  ctx.fillRect(33, 13, 2, 3);
  // arms: outward raise (+12 deg rest); elbow folds further inward
  for (const [sx, side, A] of [[25, -1, a.armL], [39, 1, a.armR]]) {
    const ang = side < 0 ? (12 + A.raise) * D2R : -(12 + A.raise) * D2R;
    seg(ctx, sx, 22, ang, 8, 3, "#f5d5bf");
    const ex = endX(sx, ang, 8), ey = endY(22, ang, 8);
    const ang2 = ang + side * A.elbow * D2R;
    seg(ctx, ex, ey, ang2, 7, 3, "#f5d5bf");
  }
  // legs: spread splays from the hips; knee fold shortens the drawn leg
  for (const [hx, side, L] of [[29, -1, a.legL], [35, 1, a.legR]]) {
    const ang = -side * L.spread * D2R;
    const shrink = 1 - Math.min(0.5, L.knee / 220 + Math.max(0, L.forward) / 170);
    seg(ctx, hx, 35, ang, 13 * shrink, 4, "#3a5ca8");
    seg(ctx, endX(hx, ang, 13 * shrink), endY(35, ang, 13 * shrink),
      ang, 6 * shrink, 4, "#e8913a");
  }
}

function drawPoseThumb(c, def) {
  let cv = thumbCache.get(def.id);
  if (!cv) {
    cv = document.createElement("canvas");
    cv.width = cv.height = 64;
    const ctx = cv.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#fffdfa";
    ctx.beginPath();
    ctx.arc(32, 32, 31, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.beginPath();
    ctx.arc(32, 32, 31, 0, Math.PI * 2);
    ctx.clip();
    drawChibi(ctx, normalizeAngles(def.angles));
    ctx.restore();
    thumbCache.set(def.id, cv);
  }
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, 64, 64);
  ctx.drawImage(cv, 0, 0);
}

// ---- panel ------------------------------------------------------------------
export function buildPosePanel({ state, onChange, setPill, buildGrid }) {
  const pose = getPoseEngine();
  setPill("POSE");

  // ---- left grid: 9 presets -----------------------------------------------
  const entries = POSE_PRESETS.map((def) => ({
    label: def.label,
    draw: (c) => drawPoseThumb(c, def),
    isActive: () => state.pose.preset === def.id,
    pick: () => {
      state.pose.preset = def.id;
      state.pose.custom = null;
      pose.sync({ animate: true });
    },
  }));
  const syncLeft = () => buildGrid(entries, state, () => refresh());

  // ---- right column: buttons + collapsible slider groups -------------------
  const rightBody = document.getElementById("rightBody");
  rightBody.replaceChildren();
  pillRow(rightBody, "POSE CONTROLS", true);

  const btnRow = el("div", "poseBtnRow", rightBody);
  const mkBtn = (label, title) => {
    const b = el("button", "poseBtn", btnRow);
    b.textContent = label;
    b.title = title;
    return b;
  };
  let symmetry = false;
  const symBtn = mkBtn("SYMMETRY", "mirrored editing (left <-> right)");
  symBtn.classList.add("poseToggle");
  const mirrorBtn = mkBtn("MIRROR", "copy left side to right side");
  const resetBtn = mkBtn("RESET", "back to pose_default");
  resetBtn.classList.add("poseReset");

  const rows = []; // [{ branch, key, input, val, dot }]

  function curAngles() {
    // what the sliders show/edit: the custom object, or the preset baseline
    return state.pose.preset === "custom" ? state.pose.custom : pose.baseline;
  }

  function seedCustom() {
    if (state.pose.preset === "custom") return state.pose.custom;
    const seed = normalizeAngles(pose.requested());
    state.pose.custom = seed;
    state.pose.preset = "custom";
    return seed;
  }

  function applyEdit(branch, key, value) {
    const a = seedCustom();
    a[branch][key] = value;
    if (symmetry) {
      const other = branch === "armL" ? "armR" : "armL";
      a[other][key] = key === "twist" ? -value : value;
    }
    pose.sync({ animate: false }); // sliders apply immediately
  }

  function sliderRow(body, branch, [key, label]) {
    const kind = branch ? (branch === "armL" || branch === "armR" ? "arm" : "leg") : "";
    const lim = branch ? LIMITS[kind][key] : LIMITS[key];
    const row = el("div", "poseRow", body);
    const lbl = el("span", "poseLbl", row);
    lbl.textContent = label;
    const input = el("input", "poseSlider", row);
    input.type = "range";
    input.min = lim[0];
    input.max = lim[1];
    input.step = 1;
    const val = el("span", "poseVal", row);
    const dot = el("button", "poseDot", row);
    dot.title = "reset to preset value";
    input.addEventListener("input", () => {
      applyEdit(branch, key, +input.value);
    });
    dot.addEventListener("click", () => {
      const bv = branch ? pose.baseline[branch][key] : pose.baseline[key];
      applyEdit(branch, key, Math.round(bv));
    });
    rows.push({ branch, key, input, val, dot });
  }

  for (const def of GROUPS) {
    const grp = el("div", "poseGrp", rightBody);
    const head = el("button", "poseGrpHead", grp);
    head.textContent = def.title;
    const body = el("div", "poseGrpBody", grp);
    head.addEventListener("click", () => grp.classList.toggle("closed"));
    for (const f of def.fields) sliderRow(body, def.branch, f);
  }

  mirrorBtn.addEventListener("click", () => {
    const a = seedCustom();
    // copy left to right (twist mirrored so the pose stays symmetric)
    a.armR = { ...a.armL, twist: -a.armL.twist };
    pose.sync({ animate: false });
  });
  symBtn.addEventListener("click", () => {
    symmetry = !symmetry;
    symBtn.classList.toggle("on", symmetry);
    if (symmetry) {
      const a = seedCustom();
      a.armR = { ...a.armL, twist: -a.armL.twist };
      pose.sync({ animate: false });
    }
  });
  resetBtn.addEventListener("click", () => {
    state.pose.preset = "pose_default";
    state.pose.custom = null;
    pose.sync({ animate: false });
  });

  function syncSliders() {
    const a = curAngles();
    for (const r of rows) {
      const v = r.branch ? a[r.branch][r.key] : a[r.key];
      const iv = Math.round(v);
      r.input.value = iv;
      r.val.textContent = `${iv}\u00B0`;
      r.dot.classList.toggle("diff", iv !== Math.round(
        r.branch ? pose.baseline[r.branch][r.key] : pose.baseline[r.key]));
    }
  }

  const refresh = () => {
    syncLeft();
    syncSliders();
  };
  refresh();
  return refresh;
}
