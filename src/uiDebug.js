// M7: dev-only state inspector. Mounted ONLY when the URL carries
// ?debug=state — normal pages get zero extra DOM. Shows the live STYLE.md
// section-8 save config (exactly what CONFIRM/EXPORT would write) plus the
// last validation warnings; COPY puts the pretty JSON on the clipboard.
// Refreshed on a cheap 600 ms timer so any change path is covered.

import { toSaveConfig } from "./state.js";
import { currentName } from "./uiState.js";

export function initStateInspector({ state, getWarnings }) {
  const params = new URLSearchParams(location.search);
  if (params.get("debug") !== "state") return null;

  const box = document.createElement("div");
  box.id = "stateInspector";
  const head = document.createElement("div");
  head.className = "inspHead";
  const title = document.createElement("span");
  title.textContent = "STATE (psxcc.v1 format)";
  const copy = document.createElement("button");
  copy.textContent = "COPY";
  copy.addEventListener("click", () => {
    navigator.clipboard?.writeText(pre.textContent ?? "").then(
      () => (copy.textContent = "OK"),
      () => (copy.textContent = "ERR")
    );
    setTimeout(() => (copy.textContent = "COPY"), 800);
  });
  head.append(title, copy);
  const pre = document.createElement("pre");
  pre.className = "inspBody";
  box.append(head, pre);
  document.body.appendChild(box);

  const tick = () => {
    pre.textContent = JSON.stringify(
      { warnings: getWarnings?.() ?? [], config: toSaveConfig(state, currentName()) },
      null, 1
    );
  };
  tick();
  return setInterval(tick, 600);
}
