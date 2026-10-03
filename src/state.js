import { DEFAULT_SKIN } from "./character.js";

// Config/state assembly: default config, debug URL params, RANDOM and RESET.
// All item ids stay data-driven from catalog.json (nothing item-specific is
// hard-coded here). `body` carries the selected body profile (M8 selector).

export const CLOTH_SLOTS = ["top", "outer", "bottom", "socks", "shoes"];
export const ACC_SLOTS = ["headwear", "eyewear", "neck", "wrist", "bag"];
export const ALL_SLOTS = [...CLOTH_SLOTS, ...ACC_SLOTS];
export const BODY_TYPES = ["female", "male"];

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
  };
}

// debug/shot params: ?body=male|female picks the body profile, ?hair=hair_XX
// etc. assign specific items; ?c=<hex> re-colours every URL-assigned slot.
export function applyUrlState(state, params) {
  const body = params.get("body");
  if (BODY_TYPES.includes(body)) state.body = body;
  for (const slot of ALL_SLOTS) {
    const v = params.get(slot);
    if (v) {
      if (v === "none") state[slot] = null;
      else if (slot === "hair") state.hair.id = v;
      else state[slot] = { id: v, colors: state[slot]?.colors ?? {} };
    }
  }
  const urlColor = params.get("c");
  if (urlColor) {
    for (const slot of ALL_SLOTS) {
      if (slot !== "hair" && state[slot]?.id) state[slot].colors.main = urlColor;
    }
  }
}

// RESET: back to the default config (mutates in place, body included)
export function resetInto(state) {
  Object.assign(state, defaultState());
}

// RANDOM: random item + colour per slot, random face, random body type
export function randomizeInto(state, catalog) {
  const hex = () =>
    "#" + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, "0");
  for (const slot of ALL_SLOTS) {
    const items = catalog.items.filter((i) => i.slot === slot);
    if (!items.length) continue;
    const pick = items[Math.floor(Math.random() * items.length)];
    if (slot === "hair") state.hair = { id: pick.id, color: hex() };
    else state[slot] = { id: pick.id, colors: { main: hex() } };
  }
  state.eyes = 1 + Math.floor(Math.random() * catalog.eyes);
  state.mouth = 1 + Math.floor(Math.random() * catalog.mouths);
  state.body = BODY_TYPES[Math.floor(Math.random() * BODY_TYPES.length)];
}
