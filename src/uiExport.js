// M9 Export panel: one PSX modal behind the GLB button offering the three
// local export routes — GLB (Photo-Studio behaviour unchanged), display OBJ
// zip and the print OBJ. Print runs the mesh-check report FIRST and only
// offers the download on top of it. Everything stays local; nothing uploads.

import "./exportUI.css";

const HEIGHTS = [50, 80, 100, 150];
const THICK = [0.8, 1.2, 2.0];
const NOTE = "Use the print OBJ for slicers; the display OBJ is for "
  + "Blender and other 3D apps.";

export function initExportUI({ hooks, openEl, download, toast }) {
  document.body.insertAdjacentHTML("beforeend", `
    <div id="exportModal" role="dialog" aria-modal="true" aria-label="Export" hidden>
      <div class="psFrame">
        <div class="psHead">
          <div class="psPill"><span class="pillStar"></span><span>EXPORT</span><span class="pillStar"></span></div>
          <button class="psClose pixBtn" aria-label="Close Export"></button>
        </div>
        <div id="exMain">
          <div class="psOpts" id="exOpts"></div>
          <div class="exNote">${NOTE}</div>
          <div class="psActions">
            <button id="exDownload" class="poseBtn">DOWNLOAD</button>
          </div>
        </div>
        <div id="exReport" hidden>
          <div class="exRePill"><span class="pillStar"></span><span>MESH CHECK</span></div>
          <div class="exReportBox" id="exReportBox"></div>
          <div id="exWarnList" hidden></div>
          <div class="psActions">
            <button id="exReportDl" class="poseBtn">DOWNLOAD</button>
            <button id="exReportBack" class="poseBtn poseReset">BACK</button>
          </div>
        </div>
        <div id="exToast" hidden></div>
      </div>
    </div>`);

  const modal = document.getElementById("exportModal");
  const main = document.getElementById("exMain");
  const reportView = document.getElementById("exReport");
  const reportBox = document.getElementById("exReportBox");
  const warnList = document.getElementById("exWarnList");
  const exToast = document.getElementById("exToast");
  const opts = document.getElementById("exOpts");
  const btnDownload = document.getElementById("exDownload");
  const btnReportDl = document.getElementById("exReportDl");
  const btnBack = document.getElementById("exReportBack");
  const closeBtn = modal.querySelector(".psClose");

  const state = {
    format: "glb", heightMm: 80, thicknessMm: 1.2,
    base: true, connectFeet: true, coloured: true,
  };
  // report-view download contract: the mesh-check result awaiting Download/Back
  let pending = null;
  // ---- option rows (same building pattern as Photo Studio) ------------------
  const rows = {};
  function segRow(label, key, values, when) {
    const r = document.createElement("div");
    r.className = "psRow";
    r.dataset.show = when ?? "always";
    const t = document.createElement("span");
    t.className = "psLbl";
    t.textContent = label;
    const grp = document.createElement("div");
    grp.className = "psSeg";
    grp.setAttribute("role", "radiogroup");
    grp.setAttribute("aria-label", label);
    const btns = {};
    for (const v of values) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = v.label;
      b.setAttribute("role", "radio");
      b.addEventListener("click", () => { state[key] = v.value; sync(); });
      grp.appendChild(b);
      btns[v.value] = b;
    }
    rows[key] = {
      node: r,
      sync() {
        for (const bv in btns) {
          const on = String(bv) === String(state[key]);
          btns[bv].classList.toggle("on", on);
          btns[bv].setAttribute("aria-checked", String(on));
        }
      },
    };
    r.append(t, grp);
    opts.appendChild(r);
  }
  function togRow(key, label, when) {
    const r = document.createElement("div");
    r.className = "psRow";
    r.dataset.show = when ?? "always";
    const t = document.createElement("span");
    t.className = "psLbl";
    t.textContent = label;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "poseBtn psToggle";
    b.textContent = label;
    b.setAttribute("aria-label", label);
    b.addEventListener("click", () => { state[key] = !state[key]; sync(); });
    rows[key] = {
      node: r,
      sync() { b.classList.toggle("on", !!state[key]); b.setAttribute("aria-pressed", String(!!state[key])); },
    };
    r.append(t, b);
    opts.appendChild(r);
  }
  const LAB = (n) => `${n}`;
  segRow("FORMAT", "format", [
    { value: "glb", label: "GLB" },
    { value: "displayOBJ", label: "OBJ+TEX" },
    { value: "printOBJ", label: "OBJ PRINT" },
  ]);
  segRow("HEIGHT", "heightMm", HEIGHTS.map((h) => ({ value: h, label: `${h}MM` })), "print");
  segRow("THICKNESS", "thicknessMm", THICK.map((t) => ({ value: t, label: LAB(t) })), "print");
  segRow("COLOUR", "coloured", [
    { value: true, label: "FULL COLOUR" },
    { value: false, label: "SINGLE" },
  ], "print");
  togRow("base", "ROUND BASE", "print");
  togRow("connectFeet", "CONNECT FEET", "print");

  function sync() {
    for (const key of Object.keys(rows)) rows[key].sync();
    opts.querySelectorAll('[data-show="print"]').forEach((r) => {
      r.style.display = state.format === "printOBJ" ? "" : "none";
    });
    btnDownload.textContent = state.format === "printOBJ" ? "CHECK + EXPORT" : "DOWNLOAD";
  }

  // ---- run / report view ------------------------------------------------------
  const fmts = {
    glb: { label: "GLB SAVED", run: () => hooks.glb() },
    displayOBJ: { label: "ZIP SAVED", run: () => hooks.displayOBJ() },
    printOBJ: {
      label: "PRINT OBJ SAVED",
      run: () => hooks.printOBJ({
        heightMm: state.heightMm, thicknessMm: state.thicknessMm,
        base: state.base, connectFeet: state.connectFeet,
        coloured: state.coloured,
      }),
    },
  };

  // in-modal pixel toast (errors / progress); saved! toasts go to main's bar
  function toast(text, isErr) {
    exToast.textContent = text;
    exToast.classList.toggle("psErr", !!isErr);
    exToast.hidden = false;
    clearTimeout(toast._t);
    if (!isErr) toast._t = setTimeout(() => { exToast.hidden = true; }, 2400);
  }

  const n2 = (v) => (Number.isFinite(v) ? v.toFixed(2) : String(v ?? "-"));
  function showReport(res) {
    pending = res;
    const r = res.report ?? {};
    const lines = [
      `TRIS          ${r.triCount ?? res.stats?.tris ?? "-"}`,
      `SHELLS        ${r.shells ?? "-"}   OVERLAPS ${r.overlaps?.length ?? 0}`,
      `OPEN EDGES    ${r.openEdges ?? "-"}`,
      `NON-MANIFOLD  ${r.nonManifoldEdges ?? "-"}`,
      `FLIPPED       ${r.flippedShells ?? 0}`,
      `WALL (MIN)    ~${n2(res.minWallMm)} MM`,
      `HEIGHT        ${state.heightMm} MM`,
      `SIZE          ${mm(r.bbox)} MM`,
    ];
    reportBox.textContent = lines.join("\n");
    const warns = [...(res.warnings ?? [])];
    warnList.textContent = warns.join("\n");
    warnList.hidden = !warns.length;
    main.hidden = true;
    reportView.hidden = false;
  }
  const mm = (b) => (b
    ? `${(b.x1 - b.x0).toFixed(1)} X ${(b.y1 - b.y0).toFixed(1)} X ${(b.z1 - b.z0).toFixed(1)}`
    : "-");
  function showMain() {
    pending = null;
    reportView.hidden = true;
    main.hidden = false;
  }

  async function exportNow() {
    const f = fmts[state.format];
    btnDownload.disabled = true;
    toast("BUILDING...", false);
    try {
      const res = await f.run();
      if (state.format === "printOBJ") {
        if (res?.ok) { showReport(res); toast("MEASURED - CHECK THE REPORT", false); }
        else toast("MESH CHECK FAILED", true);
        return;
      }
      if (!res?.ok) throw new Error(res?.errors?.join("; ") ?? "export failed");
      download(res.blob, res.filename);
      toastPass(f.label);
    } catch (err) {
      toast(String(err?.message ?? err).toUpperCase().slice(0, 60), true);
    } finally {
      btnDownload.disabled = false;
    }
  }
  // outside pixel toast (main's showSaved) - optional by contract
  function toastPass(text) { try { toast?.call(null, text); } catch { /* optional */ } }

  btnDownload.addEventListener("click", exportNow);
  btnReportDl.addEventListener("click", () => {
    if (!pending) return;
    if (!pending.ok) { toast("EXPORT FAILED - SEE TOAST", true); return; }
    download(pending.blob, pending.filename);
    showMain();
    toastPass("PRINT OBJ SAVED");
  });
  btnBack.addEventListener("click", showMain);

  // ---- open / close (parity with Photo Studio) --------------------------------
  let lastFocus = null;
  function open() {
    if (!modal.hidden) return;
    lastFocus = document.activeElement;
    showMain();
    sync();
    modal.hidden = false;
    closeBtn.focus();
  }
  function close() {
    if (modal.hidden) return;
    modal.hidden = true;
    clearTimeout(toast._t);
    (lastFocus ?? openEl)?.focus?.();
    lastFocus = null;
  }
  closeBtn.addEventListener("click", close);
  openEl?.addEventListener("click", open);
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !modal.hidden) { e.stopPropagation(); close(); }
  });
  modal.addEventListener("pointerdown", (e) => { if (e.target === modal) close(); });

  return { open, close, get isOpen() { return !modal.hidden; }, state, showReportView: showReport };
}
