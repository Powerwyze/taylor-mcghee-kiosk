import { startCameraPreview, cameraErrorMessage } from "./vendor/camera-preview.js";
import { GuestIdle } from "./vendor/host-idle.js";
import { runCountdown } from "./vendor/host-countdown.js";
import { captureStill } from "./vendor/photo-capture.js";

const $ = (id) => document.getElementById(id);
const kiosk = $("kiosk");
const HOST = "rpb-legacycon-kiosk.vercel.app";
const ASSESSMENT = "https://assessment.rpblawfirm.com";

const LOOKS = [
  { id: "agent", name: "Agent of Legacy", line: "Sharp tailoring. Oxblood and gold light." },
  { id: "builder", name: "Legacy Builder", line: "Magazine cover. Form it. Protect it. Scale it." },
  { id: "office", name: "Owner's Office", line: "A corner office at golden hour." },
];

const ICONS = {
  scale: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3"><path d="M32 8v40M20 52h24M32 14l-16 12M32 14l16 12M10 26h12l-6 12-6-12zm32 0h12l-6 12-6-12z"/></svg>',
  briefcase: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3"><rect x="8" y="20" width="48" height="32" rx="4"/><path d="M24 20v-4a8 8 0 0 1 16 0v4M8 32h48"/></svg>',
  key: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3"><circle cx="22" cy="26" r="10"/><path d="M30 32l20 14v8h-8l-4-4h-6l-4-4"/></svg>',
  shield: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3"><path d="M32 6l22 8v18c0 14-9 22-22 26C19 54 10 46 10 32V14z"/></svg>',
  handshake: '<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="3"><path d="M8 28l12-8 10 8 8-6 18 10-14 14-10-4-8 6-8-6z"/><path d="M28 28l8 8"/></svg>',
  star: '<svg viewBox="0 0 64 64" fill="currentColor"><path d="M32 6l7 16h17l-14 11 5 17-15-10-15 10 5-17L8 22h17z"/></svg>',
};

const state = {
  look: LOOKS[0],
  stream: null,
  photoBlob: null,
  resultUrl: "",
  photoId: "",
};

let session = 0;
let abort = new AbortController();
let cameraAttempt = null;
let progressTimer = 0;
let thanksTimer = 0;
let game = null;
const guestIdle = new GuestIdle({ onIdle: () => reset() });

function show(screen) {
  kiosk.dataset.screen = screen;
}

function fit() {
  const scale = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
  kiosk.style.transform = `scale(${scale})`;
}

function normalizeUsPhone(input) {
  let digits = String(input || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return "";
  if (digits[0] === "0" || digits[0] === "1" || digits[3] === "0" || digits[3] === "1") return "";
  return digits;
}

function stopCamera() {
  cameraAttempt?.abort();
  cameraAttempt = null;
  state.stream?.getTracks().forEach((track) => track.stop());
  state.stream = null;
  $("video").srcObject = null;
}

function reset() {
  session += 1;
  abort.abort();
  abort = new AbortController();
  window.clearInterval(progressTimer);
  window.clearInterval(thanksTimer);
  stopCamera();
  if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
  state.photoBlob = null;
  state.resultUrl = "";
  state.photoId = "";
  state.look = LOOKS[0];
  $("phoneInput").value = "";
  $("firstName").value = "";
  $("email").value = "";
  $("smsConsent").checked = false;
  $("phoneError").textContent = "";
  $("countdown").hidden = true;
  $("resultImage").removeAttribute("src");
  $("qrImage").removeAttribute("src");
  $("shortLink").textContent = "";
  $("waitError").hidden = true;
  $("matchGrid").replaceChildren();
  show("home");
  guestIdle.start(70000);
}

function renderLooks() {
  const grid = $("lookGrid");
  grid.replaceChildren();
  for (const look of LOOKS) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "look-card";
    const title = document.createElement("strong");
    title.textContent = look.name;
    const line = document.createElement("span");
    line.textContent = look.line;
    button.append(title, line);
    button.addEventListener("click", () => {
      state.look = look;
      openCamera();
    });
    grid.append(button);
  }
}

function setCameraUi(mode) {
  $("camera").dataset.state = mode;
  $("cameraLive").hidden = mode === "error";
  $("cameraDock").hidden = mode === "error";
  $("cameraError").hidden = mode !== "error";
  $("captureButton").hidden = mode !== "ready";
}

async function openCamera() {
  const ticket = session;
  stopCamera();
  const attempt = new AbortController();
  cameraAttempt = attempt;
  show("camera");
  $("cameraLook").textContent = state.look.name;
  setCameraUi("loading");
  $("cameraStatus").textContent = "Starting the camera…";
  $("countdown").hidden = true;
  guestIdle.setBusy(true);
  try {
    const stream = await startCameraPreview({ video: $("video"), signal: attempt.signal });
    if (ticket !== session || cameraAttempt !== attempt) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }
    state.stream = stream;
    setCameraUi("ready");
    $("cameraStatus").textContent = "Look at the lens, then tap Take photo.";
  } catch (error) {
    if (ticket !== session || error.name === "AbortError") return;
    setCameraUi("error");
    $("cameraErrorText").textContent = cameraErrorMessage(error);
  } finally {
    if (ticket === session) guestIdle.setBusy(false);
  }
}

async function capture() {
  if (!state.stream || $("captureButton").disabled) return;
  const ticket = session;
  const signal = abort.signal;
  $("captureButton").disabled = true;
  guestIdle.setBusy(true);
  $("cameraStatus").textContent = "Hold still.";
  try {
    await runCountdown({
      signal,
      seconds: 3,
      onTick: (n) => {
        $("countdown").textContent = String(n);
        $("countdown").hidden = false;
      },
    });
    $("countdown").hidden = true;
    const captureSignal = AbortSignal.any([signal, AbortSignal.timeout(12000)]);
    const { blob } = await captureStill($("video"), { signal: captureSignal });
    if (ticket !== session) return;
    state.photoBlob = blob;
    stopCamera();
    show("phone");
    $("phoneInput").focus({ preventScroll: true });
  } catch (error) {
    if (ticket !== session || signal.aborted) return;
    $("cameraStatus").textContent = "The photo was not captured. Tap Take photo to try again.";
  } finally {
    if (ticket === session) {
      $("countdown").hidden = true;
      $("captureButton").disabled = false;
      guestIdle.setBusy(false);
    }
  }
}

function activeField() {
  const el = document.activeElement;
  if (el === $("email") || el === $("firstName") || el === $("phoneInput")) return el;
  return $("phoneInput");
}

function typeKey(key) {
  const input = activeField();
  let start = input.selectionStart ?? input.value.length;
  let end = input.selectionEnd ?? start;
  if (key === "backspace" && start === end) start = Math.max(0, start - 1);
  input.setRangeText(key === "backspace" ? "" : key, start, end, "end");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.focus({ preventScroll: true });
}

function mountKeyboard() {
  const rows = ["1234567890", "qwertyuiop", "asdfghjkl", "zxcvbnm", "@._- ", "backspace"];
  const board = $("keyboard");
  for (const row of rows) {
    const line = document.createElement("div");
    line.className = "key-row";
    const keys = row === "backspace" ? ["backspace"] : [...row];
    for (const key of keys) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "key";
      button.textContent = key === "backspace" ? "Delete" : key === " " ? "Space" : key;
      button.addEventListener("pointerdown", (event) => event.preventDefault());
      button.addEventListener("click", () => typeKey(key));
      line.append(button);
    }
    board.append(line);
  }
  const domains = ["gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"];
  for (const domain of domains) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = `@${domain}`;
    button.addEventListener("pointerdown", (event) => event.preventDefault());
    button.addEventListener("click", () => {
      const email = $("email");
      const local = email.value.trim().split("@")[0];
      if (!local) {
        $("phoneError").textContent = "Type the email name first, then choose an ending.";
        email.focus({ preventScroll: true });
        return;
      }
      email.value = `${local}@${domain}`;
      email.dispatchEvent(new Event("input", { bubbles: true }));
      $("phoneError").textContent = "";
      email.focus({ preventScroll: true });
    });
    $("emailDomains").append(button);
  }
}

function buildGame() {
  const names = Object.keys(ICONS);
  const deck = names.flatMap((name) => [name, name]);
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  const grid = $("matchGrid");
  grid.replaceChildren();
  const cards = deck.map((name) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "card";
    button.dataset.icon = name;
    button.setAttribute("aria-label", "Hidden card");
    button.innerHTML = ICONS[name];
    button.querySelector("svg").style.visibility = "hidden";
    grid.append(button);
    return button;
  });
  const board = { open: [], lock: false, stopped: false };
  for (const card of cards) {
    card.addEventListener("click", () => flip(card, board));
  }
  return board;
}

function reveal(card, up) {
  card.classList.toggle("is-up", up);
  const svg = card.querySelector("svg");
  if (svg) svg.style.visibility = up || card.classList.contains("is-matched") ? "visible" : "hidden";
}

function flip(card, board) {
  if (board.stopped || board.lock || card.classList.contains("is-matched") || card.classList.contains("is-up")) return;
  reveal(card, true);
  board.open.push(card);
  if (board.open.length < 2) return;
  const [a, b] = board.open;
  board.open = [];
  if (a.dataset.icon === b.dataset.icon) {
    a.classList.add("is-matched");
    b.classList.add("is-matched");
    return;
  }
  board.lock = true;
  window.setTimeout(() => {
    if (board.stopped) return;
    reveal(a, false);
    reveal(b, false);
    board.lock = false;
  }, 700);
}

function startProgress() {
  const began = performance.now();
  $("progressBar").style.width = "4%";
  window.clearInterval(progressTimer);
  progressTimer = window.setInterval(() => {
    const ratio = Math.min(0.92, (performance.now() - began) / 52000);
    $("progressBar").style.width = `${Math.round(ratio * 100)}%`;
  }, 200);
}

function showFailure(message) {
  window.clearInterval(progressTimer);
  if (game) game.stopped = true;
  $("waitError").hidden = false;
  $("waitErrorText").textContent = message;
  $("waitStatus").textContent = "The portrait did not finish";
  guestIdle.setBusy(false);
}

async function generate() {
  const ticket = session;
  const signal = abort.signal;
  show("wait");
  $("waitError").hidden = true;
  $("waitStatus").textContent = "Briefing your mission…";
  game = buildGame();
  startProgress();
  guestIdle.setBusy(true);
  try {
    const form = new FormData();
    form.append("image", state.photoBlob, "guest-photo.jpg");
    form.append("look", state.look.id);
    form.append("phone", $("phoneInput").value);
    form.append("firstName", $("firstName").value);
    form.append("email", $("email").value);
    form.append("smsConsent", $("smsConsent").checked ? "true" : "false");
    const response = await fetch("/api/banana", {
      method: "POST",
      body: form,
      signal: AbortSignal.any([signal, AbortSignal.timeout(160000)]),
    });
    if (!response.ok) {
      const problem = await response.json().catch(() => ({}));
      throw new Error(problem.error || "The portrait could not be created.");
    }
    const blob = await response.blob();
    if (!blob.size || !String(blob.type).startsWith("image/")) throw new Error("No portrait was returned.");
    const id = response.headers.get("X-Photo-Id") || "";
    if (!id) throw new Error("The portrait link was not created.");
    if (ticket !== session) return;
    if (state.resultUrl) URL.revokeObjectURL(state.resultUrl);
    state.resultUrl = URL.createObjectURL(blob);
    state.photoId = id;
    window.clearInterval(progressTimer);
    $("progressBar").style.width = "100%";
    if (game) game.stopped = true;
    showResult();
  } catch (error) {
    if (error.name === "AbortError" || ticket !== session) return;
    showFailure(error.message || "The portrait could not be created. Try again.");
  }
}

function showResult() {
  const page = `https://${HOST}/p/${state.photoId}`;
  $("resultImage").src = state.resultUrl;
  $("qrImage").src = `/api/qr?text=${encodeURIComponent(page)}`;
  $("shortLink").textContent = `${HOST}/p/${state.photoId}`;
  $("assessLink").href = ASSESSMENT;
  show("result");
  guestIdle.setBusy(false);
  guestIdle.start(120000);
  let left = 120;
  $("resetLine").textContent = `This screen resets in ${left} seconds.`;
  window.clearInterval(thanksTimer);
  thanksTimer = window.setInterval(() => {
    left -= 1;
    if (left <= 0) {
      window.clearInterval(thanksTimer);
      reset();
      return;
    }
    $("resetLine").textContent = `This screen resets in ${left} seconds.`;
  }, 1000);
}

function submitPhone(event) {
  event.preventDefault();
  const phone = normalizeUsPhone($("phoneInput").value);
  const email = $("email").value.trim();
  if (!phone) {
    $("phoneError").textContent = "Enter a 10-digit US mobile number.";
    $("phoneInput").focus({ preventScroll: true });
    return;
  }
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    $("phoneError").textContent = "Email looks incomplete, or clear it to continue.";
    $("email").focus({ preventScroll: true });
    return;
  }
  if (!state.photoBlob) {
    $("phoneError").textContent = "Take a photo first.";
    return;
  }
  $("phoneError").textContent = "";
  generate();
}

$("startButton").addEventListener("click", () => {
  renderLooks();
  show("looks");
});
$("looksBack").addEventListener("click", () => show("home"));
$("cameraRetry").addEventListener("click", openCamera);
$("cameraBack").addEventListener("click", () => {
  stopCamera();
  renderLooks();
  show("looks");
});
$("captureButton").addEventListener("click", capture);
$("phoneBack").addEventListener("click", openCamera);
$("phoneForm").addEventListener("submit", submitPhone);
$("privacyLink").addEventListener("click", (event) => event.stopPropagation());
$("generateRetry").addEventListener("click", generate);
$("waitRetake").addEventListener("click", openCamera);
$("doneButton").addEventListener("click", reset);
document.addEventListener("pointerdown", () => {
  if (kiosk.dataset.screen !== "wait") guestIdle.touch();
});

mountKeyboard();
renderLooks();
fit();
window.addEventListener("resize", fit);
show("home");
guestIdle.start(70000);
window.addEventListener("pagehide", () => {
  stopCamera();
  abort.abort();
});
