// M8 capture preferences (Photo Studio), stored UNDER A SEPARATE KEY
// (psxcc.capture.v1) so the character saves in psxcc.v1 stay untouched and old
// saves keep loading. Fields: background/solid/look/scale/aspect; anything
// invalid falls back to the defaults (no throw). Extracted from state.js to
// keep files lean; import from here.

import { isValidHex, normalizeHex } from "./state.js";

export const CAPTURE_KEY = "psxcc.capture.v1";

export function defaultCapturePrefs() {
  return {
    background: "checker",
    solid: "#e8913a",
    look: "psx",
    scale: 1,
    aspect: "4:3",
  };
}

export function sanitizeCapturePrefs(p) {
  const d = defaultCapturePrefs();
  const out = {};
  out.background = ["transparent", "checker", "solid"].includes(p?.background)
    ? p.background : d.background;
  out.solid = isValidHex(p?.solid) ? normalizeHex(p.solid) : d.solid;
  out.look = ["psx", "clean"].includes(p?.look) ? p.look : d.look;
  out.scale = [1, 2, 4].includes(p?.scale) ? p.scale : d.scale;
  out.aspect = ["1:1", "4:3", "3:4", "9:16"].includes(p?.aspect)
    ? p.aspect : d.aspect;
  return out;
}

export function loadCapturePrefs() {
  try {
    const v = JSON.parse(localStorage.getItem(CAPTURE_KEY) ?? "{}");
    return sanitizeCapturePrefs(v);
  } catch {
    return defaultCapturePrefs();
  }
}

export function saveCapturePrefs(prefs) {
  try {
    localStorage.setItem(CAPTURE_KEY, JSON.stringify(sanitizeCapturePrefs(prefs)));
    return true;
  } catch {
    return false;
  }
}
