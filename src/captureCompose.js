import "./psxRenderer.js"; // keeps THREE.ColorManagement off app-wide

// M8 canvas compositing helpers shared by capture.js: background painting,
// pixel-font name captions and the blob encoder. Pure 2D-canvas work, no
// WebGL state. Split from capture.js to keep both files lean.

export class CaptureError extends Error {
  constructor(code, message, cause) {
    super(message ?? code);
    this.code = code; // NO_RENDERER | CONTEXT_LOST | API | BLANK
    if (cause?.stack) this.stack = cause.stack;
  }
}

// checker tokens mirror src/style.css --checker-a/--checker-b
export const CHECKER_A = "#fce38b";
export const CHECKER_B = "#f8d466";

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function paintBackground(ctx, bg, w, h) {
  if (bg.type === "transparent") return;
  if (bg.type === "solid") {
    ctx.fillStyle = HEX_RE.test(bg.color) ? bg.color : "#e8913a";
    ctx.fillRect(0, 0, w, h);
    return;
  }
  // checkerboard, same yellow-orange as the page CSS
  const min = Math.min(w, h);
  const sq = Math.max(8, Math.round(min / 10 / 2) * 2); // even size
  const cols = Math.ceil(w / sq);
  const rows = Math.ceil(h / sq);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      ctx.fillStyle = (r + c) % 2 ? CHECKER_B : CHECKER_A;
      ctx.fillRect(c * sq, r * sq, sq, sq);
    }
  }
}

export function drawName(ctx, name, w, h) {
  const text = (name || "character").toUpperCase();
  const size = Math.max(8, Math.round(h * 0.032));
  const y = h - Math.round(h * 0.028);
  const s = Math.max(1, Math.round(size / 9)); // chunky drop shadow offset
  ctx.font = `${size}px "Press Start 2P", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#38220c";
  ctx.fillText(text, w / 2 + s, y + s);
  ctx.fillStyle = "#e85878"; // STYLE.md title red
  ctx.fillText(text, w / 2, y);
}

export function toPng(canvas) {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob && blob.size > 0) resolve(blob);
        else reject(new Error("BLANK"));
      }, "image/png");
    } catch (err) {
      reject(err);
    }
  });
}
