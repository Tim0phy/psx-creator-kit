// M8 Photo Studio option rows: segmented buttons, the SOLID-colour picker
// and the toggle trio. Split from uiCapture.js (mechanical extraction; the
// factory receives the shared option state + mutators, no behaviour change).

const STOCK_SWATCHES = [
  "#fce38b", "#ffffff", "#222222", "#e85878", "#68b8e8",
  "#8fd8a8", "#e8913a", "#9fd6ff", "#f07890", "#a86ad8",
];

export function buildOptionRows({ opts, getState, set, schedule }) {
  const rows = {};

  function segRow(label, key, values, format) {
    const r = document.createElement("div");
    r.className = "psRow";
    const t = document.createElement("span");
    t.className = "psLbl";
    t.textContent = label;
    const grp = document.createElement("div");
    grp.className = "psSeg";
    grp.setAttribute("role", "radiogroup");
    grp.setAttribute("aria-label", label);
    r.append(t, grp);
    const btns = {};
    for (const v of values) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = format ? format(v) : String(v).toUpperCase();
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", "false");
      b.addEventListener("click", () => { set(key, v); schedule(); });
      grp.appendChild(b);
      btns[v] = b;
    }
    rows[key] = { sync() {
      for (const k in btns) {
        btns[k].classList.toggle("on", k === String(getState()[key]));
        btns[k].setAttribute("aria-checked", String(k === String(getState()[key])));
      }
    } };
    opts.appendChild(r);
  }

  function solidRow() {
    const r = document.createElement("div");
    r.className = "psRow";
    // conditional row: only visible while BACKGROUND = solid
    r.dataset.conditional = "solid";
    const t = document.createElement("span");
    t.className = "psLbl";
    t.textContent = "SOLID";
    const sw = document.createElement("div");
    sw.className = "psSwatches";
    const inp = document.createElement("input");
    inp.type = "color";
    inp.className = "psColor";
    inp.setAttribute("aria-label", "Solid background colour");
    const pick = (hex) => { inp.value = hex; set("solid", hex); schedule(); };
    for (const hex of STOCK_SWATCHES.slice(0, 6)) {
      const b = document.createElement("button");
      b.type = "button";
      b.style.background = hex;
      b.title = hex;
      b.setAttribute("aria-label", `Solid ${hex}`);
      b.addEventListener("click", () => pick(hex));
      sw.appendChild(b);
    }
    inp.value = getState().solid;
    inp.addEventListener("input", () => pick(inp.value));
    r.append(t, sw, inp);
    rows.solid = { sync() { inp.value = getState().solid; } };
    opts.appendChild(r);
  }

  function toggleRow(labels) {
    const r = document.createElement("div");
    r.className = "psRow";
    for (const [key, lab] of labels) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "poseBtn psToggle";
      b.textContent = lab;
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => { set(key, !getState()[key]); schedule(); });
      rows[key] = { sync() {
        b.classList.toggle("on", !!getState()[key]);
        b.setAttribute("aria-pressed", String(!!getState()[key]));
      } };
      r.appendChild(b);
    }
    opts.appendChild(r);
  }

  segRow("VIEW", "view", ["current", "front", "side", "back"],
    (v) => (v === "current" ? "CURRENT" : v.toUpperCase()));
  segRow("BACKGROUND", "background", ["transparent", "checker", "solid"],
    (v) => (v === "transparent" ? "ALPHA" : v.toUpperCase()));
  solidRow();
  segRow("LOOK", "look", ["psx", "clean"], (v) => (v === "psx" ? "PSX" : "CLEAN"));
  segRow("SIZE", "scale", [1, 2, 4], (v) => `${v}x`);
  segRow("ASPECT", "aspect", ["1:1", "4:3", "3:4", "9:16"]);
  toggleRow([["showName", "NAME TEXT"], ["platform", "PLATFORM"], ["shadow", "SHADOW"]]);

  return rows;
}

// conditional row visibility (SOLID exists only for the solid background)
export function syncConditionalRows(opts, opts2) {
  opts.querySelectorAll("[data-conditional]").forEach((r) => {
    r.style.display = opts2.background === r.dataset.conditional ? "" : "none";
  });
}
