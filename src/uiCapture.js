import {
  captureRaw, captureTurnaround, blobFromCanvas,
  CaptureError,
} from "./capture.js";
import { sanitiseName } from "./exporter.js";
import { loadCapturePrefs, saveCapturePrefs } from "./capturePrefs.js";
import { showSaved, currentName } from "./uiState.js";
import { buildOptionRows, syncConditionalRows } from "./uiCaptureRows.js";

// M8 Photo Studio modal: PSX-styled capture dialog (checkered frame, pixel
// pills, bevelled buttons). The preview IS the real capture pipeline at base
// resolution (an offscreen render, never a screenshot of the DOM), debounced
// <=300 ms. P opens / Esc closes; nothing leaves the machine.

export function initCaptureUI({ getSetup, openEl }) {
  const prefs = loadCapturePrefs();
  const session = { view: "current", showName: false, platform: false, shadow: false };

  document.body.insertAdjacentHTML("beforeend", `
    <div id="photoModal" role="dialog" aria-modal="true" aria-label="Photo Studio" hidden>
      <div class="psFrame">
        <div class="psHead">
          <div class="psPill"><span class="pillStar"></span><span>PHOTO STUDIO</span><span class="pillStar"></span></div>
          <button class="psClose pixBtn" aria-label="Close Photo Studio"></button>
        </div>
        <div class="psPreviewWrap">
          <img id="psPreview" alt="Photo studio preview" draggable="false" />
          <div id="psBusy" hidden>RENDERING...</div>
        </div>
        <div class="psOpts" id="psOpts"></div>
        <div class="psActions">
          <button id="psDownload" class="poseBtn">DOWNLOAD</button>
          <button id="psCopy" class="poseBtn">COPY</button>
          <button id="psTurn" class="poseBtn">TURNAROUND</button>
          <button id="psRetake" class="poseBtn poseReset">RETAKE</button>
        </div>
        <div id="psToast" hidden></div>
      </div>
    </div>`);

  const modal = document.getElementById("photoModal");
  const preview = document.getElementById("psPreview");
  const busy = document.getElementById("psBusy");
  const psToast = document.getElementById("psToast");
  const closeBtn = modal.querySelector(".psClose");
  const btnDownload = document.getElementById("psDownload");
  const btnCopy = document.getElementById("psCopy");
  const btnTurn = document.getElementById("psTurn");
  const btnRetake = document.getElementById("psRetake");

  let toastTimer = null;
  function toast(text, { retry = true } = {}) {
    psToast.textContent = text;
    psToast.classList.toggle("psErr", !!retry);
    let btn = psToast.querySelector("button");
    if (retry) {
      if (!btn) {
        btn = document.createElement("button");
        btn.textContent = "RETRY";
        btn.className = "poseBtn psRetry";
        btn.setAttribute("aria-label", "Retry last capture");
        btn.addEventListener("click", () => {
          psToast.hidden = true;
          actions.retake();
        });
        psToast.appendChild(btn);
      }
      btn.hidden = false;
    } else if (btn) btn.hidden = true;
    psToast.hidden = false;
    clearTimeout(toastTimer);
    if (!retry) toastTimer = setTimeout(() => (psToast.hidden = true), 2200);
  }

  // ---- option rows (builders live in uiCaptureRows.js) ------------------------
  const opts = document.getElementById("psOpts");
  const opts2 = {
    view: session.view, look: prefs.look, scale: prefs.scale,
    aspect: prefs.aspect, background: prefs.background, solid: prefs.solid,
    showName: session.showName, platform: session.platform, shadow: session.shadow,
  };

  function set(key, v) {
    opts2[key] = v;
    if (key in prefs) { prefs[key] = v; saveCapturePrefs(prefs); }
    Object.assign(session, {
      view: opts2.view, showName: opts2.showName,
      platform: opts2.platform, shadow: opts2.shadow,
    });
    for (const r of Object.values(rows)) r.sync();
    // conditional rows: the SOLID picker only exists while BACKGROUND=solid
    syncConditionalRows(opts, opts2);
  }

  const rows = buildOptionRows({ opts, getState: () => opts2, set, schedule });
  // apply the initial conditional visibility (SOLID row)
  syncConditionalRows(opts, opts2);

  // ---- capture plumbing -------------------------------------------------------
  let pending = null; // latest-arg debounce slot (<=300 ms, max 1 queued run)
  let busyCount = 0;

  function currentOptions(scale = opts2.scale) {
    return {
      view: opts2.view, look: opts2.look, scale, aspect: opts2.aspect,
      showName: opts2.showName, name: currentName() || "character",
      platform: opts2.platform, shadow: opts2.shadow,
      background: opts2.background === "solid"
        ? { type: "solid", color: opts2.solid }
        : { type: opts2.background },
    };
  }

  function markBusy(v) {
    busyCount = Math.max(0, busyCount + (v ? 1 : -1));
    busy.hidden = busyCount === 0;
    for (const b of [btnDownload, btnCopy, btnTurn, btnRetake]) {
      b.disabled = busyCount > 0;
    }
  }

  async function refreshPreview() {
    const setup = getSetup();
    if (!setup) return;
    markBusy(true);
    try {
      const c = await captureRaw(setup, currentOptions(1)); // preview always 1x
      psToast.hidden = true;
      preview.src = c.toDataURL("image/png");
      if (c._capped) toast("SIZE CAPPED TO 4096PX", { retry: false });
    } catch (err) {
      handleError(err, "preview");
    } finally {
      markBusy(false);
      if (pending) { const p = pending; pending = null; p(); }
    }
  }

  function schedule() {
    if (busyCount > 0) { pending = () => refreshPreview(); return; }
    clearTimeout(schedule._t);
    schedule._t = setTimeout(refreshPreview, 280); // spec: <=300 ms debounce
  }

  function handleError(err, what) {
    const code = err instanceof CaptureError ? err.code : "API";
    const btn = toast(`${what.toUpperCase()} FAILED (${code})`, { retry: true });
    btn?.focus();
  }

  function download(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  async function guarded(fn, label) {
    const setup = getSetup();
    if (!setup) return;
    markBusy(true);
    try {
      await fn(setup);
    } catch (err) {
      handleError(err, label);
    } finally {
      markBusy(false);
      if (pending) { const p = pending; pending = null; p(); }
    }
  }

  const shotName = (dims, view) =>
    `psx-character-${sanitiseName(currentName() || "character")}-${view}-${dims[0]}x${dims[1]}.png`;

  const actions = {
    retake: () => guarded(async () => refreshPreview(), "retake"),
    async download(setup) {
      const c = await captureRaw(setup, currentOptions());
      const blob = await blobFromCanvas(c);
      const fn = shotName(c._dims, opts2.view);
      if (c._capped) toast("SIZE CAPPED TO 4096PX", { retry: false });
      download(blob, fn);
      showSaved("PNG SAVED");
    },
    async copy(setup) {
      const c = await captureRaw(setup, currentOptions());
      const blob = await blobFromCanvas(c);
      if (!window.ClipboardItem || !navigator.clipboard?.write) {
        toast("CLIPBOARD NOT SUPPORTED", { retry: false });
        download(blob, shotName(c._dims, opts2.view));
        return;
      }
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        showSaved("COPIED");
      } catch {
        toast("CLIPBOARD BLOCKED", { retry: false });
        download(blob, shotName(c._dims, opts2.view));
      }
    },
    async turnaround(setup) {
      const { blob, dims } = await captureTurnaround(setup, currentOptions());
      download(blob, shotName(dims, "turnaround"));
      showSaved("SHEET SAVED");
    },
  };

  btnRetake.addEventListener("click", actions.retake);
  btnDownload.addEventListener("click", () => guarded(actions.download, "download"));
  btnCopy.addEventListener("click", () => guarded(actions.copy, "copy"));
  btnTurn.addEventListener("click", () => guarded(actions.turnaround, "turnaround"));

  // ---- open / close -----------------------------------------------------------
  let lastFocus = null;
  function open() {
    if (!modal.hidden) return;
    lastFocus = document.activeElement;
    modal.hidden = false;
    for (const r of Object.values(rows)) r.sync();
    refreshPreview();
    closeBtn.focus();
  }
  function close() {
    if (modal.hidden) return;
    modal.hidden = true;
    clearTimeout(schedule._t);
    (lastFocus ?? openEl)?.focus?.();
    lastFocus = null;
  }

  closeBtn.addEventListener("click", close);
  openEl?.addEventListener("click", open);

  window.addEventListener("keydown", (e) => {
    if (!e.key) return;
    const tag = document.activeElement?.tagName;
    const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(tag);
    if (e.key === "Escape" && !modal.hidden) {
      e.stopPropagation();
      close();
    } else if (e.key.toLowerCase() === "p" && !typing && modal.hidden) {
      e.preventDefault();
      open();
    }
  });
  modal.addEventListener("pointerdown", (e) => { if (e.target === modal) close(); });

  // ---- test hooks -------------------------------------------------------------
  return {
    open, close, refreshPreview,
    get isOpen() { return !modal.hidden; },
    toastNode: psToast,
  };
}
