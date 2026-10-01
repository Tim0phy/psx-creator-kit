// Drag / arrow keys / A-D / touch rotation + auto-rotation toggle.

export function createControls({ getAuto, setAuto }) {
  let yaw = -0.5;
  const listeners = { yaw: [] };
  function emit() {
    listeners.yaw.forEach((f) => f(yaw));
  }

  let dragging = false;
  let lastX = 0;
  const dom = document.getElementById("stage");

  dom.style.touchAction = "none";
  dom.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    dom.setPointerCapture(e.pointerId);
  });
  dom.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    yaw += (e.clientX - lastX) * 0.01;
    lastX = e.clientX;
    emit();
  });
  const stop = (e) => {
    dragging = false;
    if (dom.hasPointerCapture(e.pointerId)) dom.releasePointerCapture(e.pointerId);
  };
  dom.addEventListener("pointerup", stop);
  dom.addEventListener("pointercancel", stop);

  window.addEventListener("keydown", (e) => {
    const step = 0.15;
    if (e.key === "ArrowLeft" || e.key === "a") {
      yaw += step;
      emit();
    } else if (e.key === "ArrowRight" || e.key === "d") {
      yaw -= step;
      emit();
    }
  });

  const btn = document.getElementById("btnRotate");
  function renderBtn() {
    btn.classList.toggle("on", getAuto());
  }
  btn.addEventListener("click", () => {
    setAuto(!getAuto());
    renderBtn();
  });
  renderBtn();

  return {
    get yaw() {
      return yaw;
    },
    set yaw(v) {
      yaw = v;
      emit();
    },
    addYaw: (f) => listeners.yaw.push(f),
  };
}
