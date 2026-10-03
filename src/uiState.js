// M7 state: name field, dice (random name), RANDOM / RESET top buttons,
// CONFIRM -> localStorage psxcc.v1 + pixel SAVED toast.
// Config format otherwise untouched (name is an extra optional field).

const NAMES = [
  "MISO", "PEBBLE", "TOFU", "PCHAN", "MOCHI", "BEAN", "SODA",
  "PICO", "YUZU", "NUDGIE", "BUBU", "KIKO",
];

function randName() {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

export function initNameSave({ onConfirm }) {
  const input = document.getElementById("nameInput");
  const dice = document.getElementById("btnDice");
  const confirm = document.getElementById("btnConfirm");

  function currentName() {
    return (input.value || "").slice(0, 12);
  }

  input.addEventListener("input", () => {
    if (input.value.length > 12) input.value = input.value.slice(0, 12);
  });

  dice.addEventListener("click", () => {
    input.value = randName();
  });

  confirm.addEventListener("click", () => {
    const cfg = load();
    cfg.name = currentName();
    localStorage.setItem("psxcc.v1", JSON.stringify(cfg));
    onConfirm?.();
  });

  // prefill from any previous save
  const saved = load();
  if (saved.name) input.value = saved.name;
}

export function load() {
  try {
    return JSON.parse(localStorage.getItem("psxcc.v1") ?? "{}") ?? {};
  } catch {
    return {};
  }
}

export function showSaved() {
  const toast = document.getElementById("toast");
  toast.classList.add("show");
  clearTimeout(showSaved._t);
  showSaved._t = setTimeout(() => toast.classList.remove("show"), 1400);
}
