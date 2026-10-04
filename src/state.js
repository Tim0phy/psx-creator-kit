import catalog from "./catalog.js";
import { DEFAULT_SKIN } from "./character.js";
import { POSE_PRESETS } from "./catalog.js";
import { normalizeAngles } from "./pose.js";

// Config/state assembly: default config, debug URL params, RANDOM and RESET.
// M7: the PERSISTED format is the STYLE.md section-8 config (localStorage key
// psxcc.v1, JSON export/import): colours are arrays indexed by the item's
// colorSlots order ([0]=main, [1]=secondary), hair carries {id, color}, pose
// is {preset, custom}. The runtime state keeps named colour maps
// (colors.main / colors.secondary) for the UI + builders. toSaveConfig() /
// applySaveConfig() are the single conversion + validation boundary between
// the two. All item ids stay data-driven from catalog.json.

export const CLOTH_SLOTS = ["top", "outer", "bottom", "socks", "shoes"];
export const ACC_SLOTS = ["headwear", "eyewear", "neck", "wrist", "bag"];
export const ALL_SLOTS = [...CLOTH_SLOTS, ...ACC_SLOTS];
export const BODY_TYPES = ["female", "male"];
export const SAVE_KEY = "psxcc.v1"; // STYLE.md section 8

export function defaultPoseState() {
  return { preset: "pose_default", custom: null };
}

export function defaultState() {
  return {
    body: "female",
    skin: DEFAULT_SKIN, eyes: 3, mouth: 1, blush: false,
    hair: { id: "hair_01", color: "#ffffff" },
    top: { id: "top_tee", colors: { main: "#e06060" } },
    outer: null,
    bottom: { id: "bot_long_pants", colors: { main: "#3a5ca8" } },
    socks: null,
    shoes: { id: "shoe_sneaker", colors: { main: "#e8913a" } },
    headwear: null, eyewear: null,
    neck: null, wrist: null, bag: null,
    pose: defaultPoseState(),
  };
}

// ---- colour / id validation -------------------------------------------------
const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isValidHex(v) {
  return typeof v === "string" && HEX_RE.test(v.trim());
}

// "#ABC" -> "#aabbcc"; invalid -> the fallback (default "#ffffff")
export function normalizeHex(v, fallback = "#ffffff") {
  if (!isValidHex(v)) return fallback;
  const s = v.trim();
  if (s.length === 4)
    return "#" + s.slice(1).split("").map((c) => (c + c).toLowerCase()).join("");
  return s.toLowerCase();
}

// catalog lookup that also verifies the id belongs to the expected slot
export function catalogItem(id, slot) {
  const item = catalog.items.find((i) => i.id === id) ?? null;
  return item && (!slot || item.slot === slot) ? item : null;
}

// M6.5 validator: keep only known presets / well-formed custom angles.
// Unknown or missing values fall back to pose_default (old saves load).
export function sanitizePose(state) {
  let p = state.pose ?? {};
  if (typeof p !== "object") p = {};
  let preset = p.preset;
  if (preset !== "custom" && !POSE_PRESETS.some((x) => x.id === preset))
    preset = "pose_default";
  const custom = preset === "custom" ? normalizeAngles(p.custom ?? {}) : null;
  state.pose = { preset, custom };
  return state.pose;
}

// ---- STYLE.md section-8 save config -----------------------------------------
// serialize the runtime state into the canonical save/JSON-file format.
// Unknown ids and invalid colours are sanitized here too, so anything this
// app saves (CONFIRM / EXPORT / import write-through) is always valid.
export function toSaveConfig(state, name = null) {
  const d = defaultState();
  const cfg = {
    skin: normalizeHex(state.skin, d.skin),
    eyes: state.eyes,
    mouth: state.mouth,
    hair: { id: null, color: "#ffffff" },
    headwear: null, eyewear: null,
    top: null, outer: null, bottom: null, socks: null, shoes: null,
    neck: null, wrist: null, bag: null,
    pose: { preset: d.pose.preset, custom: null },
    body: state.body,
    blush: !!state.blush,
  };
  if (catalogItem(state.hair?.id, "hair"))
    cfg.hair = { id: state.hair.id, color: normalizeHex(state.hair.color) };
  else if (state.hair !== undefined)
    cfg.hair = { id: null, color: "#ffffff" }; // bare head is a valid choice
  for (const slot of ALL_SLOTS) {
    const entry = state[slot];
    const item = entry && catalogItem(entry.id, slot);
    if (!item) continue;
    const cs = item.colorSlots ?? ["main"];
    const colors = new Array(cs.length);
    if (cs.includes("main"))
      colors[cs.indexOf("main")] = normalizeHex(entry.colors?.main);
    if (cs.includes("secondary")) {
      const v = normalizeHex(entry.colors?.secondary, "");
      if (v) colors[cs.indexOf("secondary")] = v; // absent -> derived shade
    }
    cfg[slot] = { id: item.id, colors: colors.filter((c) => c !== undefined) };
  }
  if (state.pose && POSE_PRESETS.some((p) => p.id === state.pose.preset))
    cfg.pose = { preset: state.pose.preset, custom: null };
  else if (state.pose?.preset === "custom")
    cfg.pose = { preset: "custom", custom: normalizeAngles(state.pose.custom ?? {}) };
  if (BODY_TYPES.includes(state.body)) cfg.body = state.body;
  if (typeof name === "string" && name.trim())
    cfg.name = name.trim().slice(0, 12);
  return cfg;
}

// colours: colorSlots-indexed arrays (STYLE.md format) or the legacy runtime
// {main, secondary} map (pre-M7 stores) both accepted
function mapColors(item, src, warnings, slot) {
  const cs = item.colorSlots ?? ["main"];
  const colors = {};
  for (let i = 0; i < cs.length; i++) {
    const k = cs[i];
    const raw = Array.isArray(src) ? src[i] : src?.[k];
    if (isValidHex(raw)) colors[k] = normalizeHex(raw, raw);
    else if (k === "main") colors.main = "#ffffff";
    if (raw !== undefined && !isValidHex(raw))
      warnings.push(`${slot}.colors[${k}]: invalid colour -> ${k === "main" ? "#ffffff" : "derived"}`);
  }
  return colors;
}

// apply a previously saved config (psxcc.v1 object / imported JSON).
// Validation rules: unknown ids -> slot none (hair -> the default hair),
// invalid colours/eyes/mouth -> previous or default value, unknown ->
// untouched. Missing keys keep the current (boot: default) config. Never
// throws; returns a warning report for the console / dev inspector.
export function applySaveConfig(state, saved) {
  if (!saved || typeof saved !== "object" || Array.isArray(saved))
    return { ok: false, warnings: ["not a config object; nothing applied"] };
  const d = defaultState();
  const warnings = [];

  if (saved.skin !== undefined) {
    if (isValidHex(saved.skin)) state.skin = normalizeHex(saved.skin);
    else warnings.push(`skin: invalid colour -> kept ${state.skin}`);
  }
  const intField = (v, max, label) => {
    if (Number.isInteger(v) && v >= 1 && v <= max) state[label] = v;
    else warnings.push(`${label}: ${JSON.stringify(v)} -> kept ${state[label]}`);
  };
  if (saved.eyes !== undefined) intField(saved.eyes, catalog.eyes, "eyes");
  if (saved.mouth !== undefined) intField(saved.mouth, catalog.mouths, "mouth");
  if (saved.blush !== undefined) state.blush = saved.blush === true;

  if (saved.hair !== undefined) {
    const h = saved.hair;
    if (h === null) state.hair = { id: null, color: "#ffffff" };
    else if (typeof h === "object" && !Array.isArray(h)) {
      const id = typeof h.id === "string" ? h.id : null;
      if (id && catalogItem(id, "hair")) {
        const col = h.color === undefined || h.color === null
          ? "#ffffff" : normalizeHex(h.color, "");
        if (col) state.hair = { id, color: col };
        else {
          state.hair = { id, color: "#ffffff" };
          warnings.push("hair.color: invalid -> #ffffff");
        }
      } else {
        state.hair = { ...d.hair };
        warnings.push(`hair: unknown id ${JSON.stringify(h?.id ?? null)} -> ${d.hair.id}`);
      }
    } else {
      state.hair = { ...d.hair };
      warnings.push("hair: wrong shape -> default");
    }
  }

  for (const slot of ALL_SLOTS) {
    const v = saved[slot];
    if (v === undefined) continue;
    if (v === null) {
      state[slot] = null;
      continue;
    }
    const item = typeof v === "object" && !Array.isArray(v) && typeof v.id === "string"
      ? catalogItem(v.id, slot)
      : null;
    if (!item) {
      state[slot] = null;
      warnings.push(`${slot}: unknown item ${JSON.stringify(v?.id ?? v)} -> none`);
      continue;
    }
    state[slot] = { id: item.id, colors: mapColors(item, v.colors, warnings, slot) };
  }

  if (saved.body !== undefined) {
    if (BODY_TYPES.includes(saved.body)) state.body = saved.body;
    else warnings.push(`body: ${JSON.stringify(saved.body)} -> kept ${state.body}`);
  }

  if (saved.pose !== undefined) {
    const p = saved.pose;
    if (p && typeof p === "object" && !Array.isArray(p))
      state.pose = { preset: p.preset ?? "pose_default", custom: p.custom ?? null };
    else {
      state.pose = defaultPoseState();
      warnings.push("pose: wrong shape -> default");
    }
  }
  sanitizePose(state);

  const name = typeof saved.name === "string" ? saved.name.trim().slice(0, 12) : "";
  return { ok: true, warnings, name: name || null };
}

// debug/shot params: ?body=male|female picks the body profile, ?hair=hair_XX
// etc. assign specific items ("none" / "hair_none" empties a slot);
// ?c=<hex> re-colours every URL-assigned slot; ?pose=<presetId> picks a pose.
// M7: ids are validated against the catalog, and ?hair= works again (the old
// loop never contained the hair slot, so the param was dead).
export function applyUrlState(state, params) {
  const body = params.get("body");
  if (BODY_TYPES.includes(body)) state.body = body;
  for (const slot of [...ALL_SLOTS, "hair"]) {
    const v = params.get(slot);
    if (!v) continue;
    const item = v === "none" || v === "hair_none" ? null : catalogItem(v, slot);
    if (slot === "hair") {
      state.hair = item
        ? { id: item.id, color: state.hair?.color ?? "#ffffff" }
        : { id: null, color: "#ffffff" };
    } else {
      state[slot] = item ? { id: item.id, colors: state[slot]?.colors ?? {} } : null;
    }
  }
  const urlColor = params.get("c");
  if (urlColor && isValidHex(urlColor)) {
    const hex = normalizeHex(urlColor, urlColor);
    for (const slot of ALL_SLOTS) {
      if (slot !== "hair" && state[slot]?.id) state[slot].colors.main = hex;
    }
  }
  const poseParam = params.get("pose");
  if (poseParam && POSE_PRESETS.some((x) => x.id === poseParam))
    state.pose = { preset: poseParam, custom: null };
}

// RESET: back to the default config (mutates in place, body included)
export function resetInto(state) {
  Object.assign(state, defaultState());
}

// RANDOM: random item + colour per slot (secondary colours included where
// the item has a second slot), random skin from the catalog palette, random
// face + body type. M6.5: pose = a random catalog preset (never sliders).
export function randomizeInto(state, catalog) {
  const hex = () =>
    "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
  for (const slot of ALL_SLOTS) {
    const items = catalog.items.filter((i) => i.slot === slot);
    if (!items.length) continue;
    const pick = items[Math.floor(Math.random() * items.length)];
    if (slot === "hair") state.hair = { id: pick.id, color: hex() };
    else {
      const colors = { main: hex() };
      if ((pick.colorSlots ?? ["main"]).includes("secondary"))
        colors.secondary = hex();
      state[slot] = { id: pick.id, colors };
    }
  }
  const skins = catalog.palettes?.skin ?? [];
  if (skins.length) state.skin = skins[Math.floor(Math.random() * skins.length)];
  state.eyes = 1 + Math.floor(Math.random() * catalog.eyes);
  state.mouth = 1 + Math.floor(Math.random() * catalog.mouths);
  state.body = BODY_TYPES[Math.floor(Math.random() * BODY_TYPES.length)];
  if (POSE_PRESETS.length)
    state.pose = {
      preset: POSE_PRESETS[Math.floor(Math.random() * POSE_PRESETS.length)].id,
      custom: null,
    };
}
