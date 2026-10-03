import catalog from "./catalog.js";

// Shared UI widget helpers (extracted from ui.js in the M8 body-selector
// round): DOM helpers, pixel pill rows, canvas cells and the colour group
// widget. No behaviour change vs ui.js — pure mechanical extraction.

export const $ = (id) => document.getElementById(id);

export function el(tag, cls, parent) {
  const d = document.createElement(tag);
  if (cls) d.className = cls;
  if (parent) parent.appendChild(d);
  return d;
}

export function cell64() {
  // 64x64 offscreen thumbnail cache (per grid cell), pixelated display
  const cv = document.createElement("canvas");
  cv.width = cv.height = 64;
  return cv;
}

export function pillRow(parent, text, withStars) {
  const pill = el("div", withStars ? "rightPill" : "void", parent);
  if (withStars) {
    el("span", "pillStar", pill);
    const t = el("span", null, pill);
    t.textContent = text;
    el("span", "pillStar", pill);
  } else {
    pill.textContent = text;
  }
  return pill;
}

export function itemsFor(slot) {
  return catalog.items.filter((i) => i.slot === slot);
}

// big pixel number per item id (like the ref-hair UI)
export function drawNum(ctx, n, col) {
  ctx.fillStyle = col;
  ctx.font = "28px 'Press Start 2P', monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), 32, 36);
}

// one stacked colour group on the right panel; owner/key identify the field
export function colourGroup(parent, title, key, ownerObj, swatches, { refresh, onChange }) {
  const grp = el("div", "colorGroup", parent);
  pillRow(grp, title, true);
  const row = el("div", "swatchRow", grp);
  const btns = swatches.map((hex) => {
    const b = el("button", "swatchBtn", row);
    b.dataset.sw = `${key}:${hex.toLowerCase()}`;
    b.style.background = hex;
    b.title = hex;
    b.addEventListener("click", () => setColor(hex));
    return b;
  });
  const custom = el("input", "customSkin", row);
  custom.type = "color";
  custom.value = ownerObj[key];
  custom.title = "custom colour";
  custom.addEventListener("input", () => setColor(custom.value));
  function setColor(hex) {
    ownerObj[key] = hex;
    if (key === "secondary") ownerObj.secondaryFollow = false;
    custom.value = hex;
    refresh();
    onChange();
  }
  return {
    sync: () => {
      btns.forEach((b) =>
        b.classList.toggle(
          "active",
          b.dataset.sw === `${key}:${ownerObj[key]?.toLowerCase()}`
        )
      );
      custom.value = ownerObj[key];
    },
  };
}

// rebuild the whole right column synchronised with current state
export function buildRight(rightBody, groups, hooks) {
  rightBody.replaceChildren();
  const syncs = groups.map(({ title, key, owner, swatches }) =>
    colourGroup(rightBody, title, key, owner, swatches, hooks)
  );
  return () => syncs.forEach((s) => s.sync());
}
