// M7 state persistence: CONFIRM -> validated STYLE.md section-8 config in
// localStorage psxcc.v1 + pixel toast; JSON-file EXPORT / IMPORT with the
// same format (write-through on import so a reload keeps the loaded look).
// Validation happens in state.js (applySaveConfig / toSaveConfig); invalid
// files / configs show the INVALID toast and leave the character untouched.

import { toSaveConfig } from "./state.js";

const NAMES = [
  "MISO", "PEBBLE", "TOFU", "PCHAN", "MOCHI", "BEAN", "SODA",
  "PICO", "YUZU", "NUDGIE", "BUBU", "KIKO",
];

function randName() {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

export function currentName() {
  const input = document.getElementById("nameInput");
  return ((input?.value ?? "") || "").trim().slice(0, 12);
}

// persist the current config (CONFIRM button / import write-through)
export function saveNow(state) {
  const cfg = toSaveConfig(state, currentName());
  try {
    localStorage.setItem("psxcc.v1", JSON.stringify(cfg));
    return true;
  } catch {
    return false;
  }
}

// last saved config (boot restore / name prefill). Invalid JSON -> {}
export function load() {
  try {
    const v = localStorage.getItem("psxcc.v1");
    if (!v) return {};
    return JSON.parse(v) ?? {};
  } catch {
    console.warn("[psxcc] psxcc.v1 holds invalid JSON; ignored");
    return {};
  }
}

export function showSaved(text = "SAVED") {
  const toast = document.getElementById("toast");
  toast.textContent = text;
  toast.classList.add("show");
  clearTimeout(showSaved._t);
  showSaved._t = setTimeout(() => toast.classList.remove("show"), 1400);
}

// name field + dice + CONFIRM (writes psxcc.v1)
export function initNameSave({ state, onConfirm }) {
  const input = document.getElementById("nameInput");
  const dice = document.getElementById("btnDice");
  const confirm = document.getElementById("btnConfirm");
  if (!input || !dice || !confirm) return; // stale-HMR partial DOM: skip safely

  input.setAttribute("maxlength", "12");
  input.addEventListener("input", () => {
    if (input.value.length > 12) input.value = input.value.slice(0, 12);
  });
  dice.addEventListener("click", () => {
    input.value = randName();
  });

  confirm.addEventListener("click", () => {
    saveNow(state);
    input.value = currentName(); // mirrors the trim applied on save
    onConfirm?.();
  });

  // prefill from any previous save
  const saved = load();
  if (typeof saved.name === "string") input.value = saved.name.slice(0, 12);
}

// JSON-file export/import (STYLE.md section 8). onImport receives the
// parsed object — main.js validates (applySaveConfig), applies and shows
// warnings; a parse failure shows INVALID and changes nothing.
export function initJsonTransfer({ state, onImport }) {
  const file = document.getElementById("fileImport");
  const btnExport = document.getElementById("btnExport");
  const btnImport = document.getElementById("btnImport");
  if (!file || !btnExport || !btnImport) return; // stale-HMR partial DOM: skip
  btnExport.addEventListener("click", () => {
    const data = JSON.stringify(toSaveConfig(state, currentName()), null, 2);
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "psxcc-character.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    showSaved("EXPORTED");
  });
  btnImport.addEventListener("click", () => file.click());
  file.addEventListener("change", async () => {
    const f = file.files?.[0];
    file.value = ""; // allow re-importing the same file
    if (!f) return;
    try {
      onImport(JSON.parse(await f.text()));
      showSaved("LOADED");
    } catch {
      showSaved("INVALID");
    }
  });
}
