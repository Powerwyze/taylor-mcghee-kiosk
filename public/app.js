/* ================================================================
 *  RPB Law Firm · Urban Golf Weekend — portrait kiosk
 *  Flow: attract → photo (camera or placeholder) → golf-ball print
 *        → business assessment → thank you / reset
 *  DEMO-006 internal. English. OpenAI guest image generation. No staff email. No phone.
 * ================================================================ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const state = {
  health: null,
  photoBlob: null,
  photoUrl: null,
  usedPlaceholder: false,
  printLine: "",
  printQueueId: "",
  printed: false,
  lastLead: null,
};

const IDLE_MS = 90 * 1000;
let idleTimer = null;

(function lockKiosk() {
  document.addEventListener("contextmenu", (e) => e.preventDefault(), { capture: true });
  const blockKeys = new Set(["t", "n", "w", "r", "p", "s", "u", "j", "h", "l", "o", "f"]);
  document.addEventListener("keydown", (e) => {
    const k = (e.key || "").toLowerCase();
    if ((e.ctrlKey || e.metaKey) && blockKeys.has(k)) { e.preventDefault(); e.stopPropagation(); }
    if (e.key === "F11" || e.key === "F5") e.preventDefault();
  }, { capture: true });
  document.addEventListener("dragstart", (e) => e.preventDefault());
  document.addEventListener("selectstart", (e) => {
    if (!e.target.closest("input, textarea, [contenteditable]")) e.preventDefault();
  });
})();

function bumpIdle() {
  clearTimeout(idleTimer);
  const attractOn = $("#screenAttract")?.classList.contains("is-active");
  if (attractOn) return;
  idleTimer = setTimeout(() => resetToAttract(), IDLE_MS);
}

["pointerdown", "keydown", "touchstart"].forEach((ev) => {
  document.addEventListener(ev, bumpIdle, { passive: true });
});

function showScreen(id) {
  $$(".screen").forEach((el) => {
    const on = el.id === id;
    if (!on && el.contains(document.activeElement)) {
      try { document.activeElement.blur(); } catch (_) {}
    }
    el.classList.toggle("is-active", on);
    el.hidden = !on;
    el.setAttribute("aria-hidden", on ? "false" : "true");
  });
  const stepMap = {
    screenAttract: "attract",
    screenBooth: "booth",
    screenBall: "ball",
    screenLead: "lead",
    screenThanks: "lead",
  };
  const step = stepMap[id];
  $$(".steps__item").forEach((el) => {
    el.classList.toggle("is-active", el.getAttribute("data-step") === step);
  });
  bumpIdle();
}

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");
}

function queueId() {
  const n = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `UGW-${n}`;
}

/* ---------- Golf ball preview (canvas, no hardware) ---------- */

function drawGolfBall(printLine) {
  const canvas = $("#ballCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;
  const cx = W / 2;
  const cy = H / 2 + 8;
  const r = Math.min(W, H) * 0.38;

  ctx.clearRect(0, 0, W, H);
  const floor = ctx.createRadialGradient(cx, H * 0.86, 10, cx, H * 0.86, W * 0.36);
  floor.addColorStop(0, "rgba(92,26,36,0.16)");
  floor.addColorStop(1, "rgba(92,26,36,0)");
  ctx.fillStyle = floor;
  ctx.beginPath();
  ctx.ellipse(cx, H * 0.86, r * 0.92, r * 0.18, 0, 0, Math.PI * 2);
  ctx.fill();

  const sphere = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.12, cx, cy, r);
  sphere.addColorStop(0, "#FFFDF8");
  sphere.addColorStop(0.45, "#F3E6D0");
  sphere.addColorStop(1, "#C9A888");
  ctx.fillStyle = sphere;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "rgba(92,26,36,0.16)";
  ctx.lineWidth = 1.2;
  for (let row = -7; row <= 7; row++) {
    const y = cy + row * (r / 6.2);
    const half = Math.sqrt(Math.max(0, r * r - (y - cy) * (y - cy)));
    const offset = (row % 2) * (r / 9);
    for (let x = cx - half + offset; x < cx + half; x += r / 4.6) {
      ctx.beginPath();
      ctx.arc(x, y, r / 18, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = "rgba(92,26,36,0.88)";
  ctx.fillRect(cx - r * 0.62, cy - r * 0.16, r * 1.24, r * 0.34);
  ctx.fillStyle = "#F3E6D0";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "700 28px 'Cormorant Garamond', Georgia, serif";
  ctx.fillText("RPB LAW FIRM", cx, cy - 6);
  const line = (printLine || "").trim().slice(0, 12).toUpperCase();
  ctx.font = "600 22px Oswald, sans-serif";
  ctx.fillText(line || "YOUR NAME", cx, cy + 22);
  ctx.restore();

  ctx.strokeStyle = "rgba(92,26,36,0.35)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
}

/* ---------- Photo booth ---------- */

const booth = (() => {
  const cam = $("#boothCam");
  const preview = $("#boothPreview");
  const canvas = $("#boothCanvas");
  const countdown = $("#boothCountdown");
  const flashEl = $("#boothFlash");
  const errEl = $("#boothErr");
  const fallback = $("#boothFallback");
  let stream = null;

  const showErr = (m) => { errEl.textContent = m || ""; };
  const clearErr = () => { errEl.textContent = ""; };

  async function stopCam() {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    if (cam) cam.srcObject = null;
  }

  function videoReady(timeoutMs = 800) {
    return new Promise((res) => {
      const t0 = Date.now();
      const tick = () => {
        if (cam.videoWidth > 0 && cam.videoHeight > 0) return res(true);
        if (Date.now() - t0 > timeoutMs) return res(false);
        requestAnimationFrame(tick);
      };
      tick();
    });
  }

  function placeholderBlob() {
    const c = document.createElement("canvas");
    c.width = 1080;
    c.height = 1920;
    const ctx = c.getContext("2d");
    const g = ctx.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, "#3D1018");
    g.addColorStop(1, "#5C1A24");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = "#F3E6D0";
    ctx.lineWidth = 18;
    ctx.strokeRect(36, 36, c.width - 72, c.height - 72);
    ctx.fillStyle = "#F3E6D0";
    ctx.textAlign = "center";
    ctx.font = "700 64px 'Cormorant Garamond', Georgia, serif";
    ctx.fillText("RPB LAW FIRM", c.width / 2, c.height / 2 - 20);
    ctx.font = "600 28px Oswald, sans-serif";
    ctx.fillText("URBAN GOLF WEEKEND", c.width / 2, c.height / 2 + 40);
    ctx.font = "500 22px Inter, sans-serif";
    ctx.fillText("Photo placeholder", c.width / 2, c.height / 2 + 90);
    return new Promise((resolve) => c.toBlob((b) => resolve(b), "image/jpeg", 0.92));
  }

  async function start() {
    clearErr();
    preview.hidden = true;
    fallback.hidden = true;
    cam.hidden = false;
    try {
      await stopCam();
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("No camera API");
      const tries = [
        { video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1920 } }, audio: false },
        { video: { facingMode: "user" }, audio: false },
        { video: true, audio: false },
      ];
      let lastErr;
      for (const constraints of tries) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          cam.srcObject = stream;
          cam.muted = true;
          cam.setAttribute("playsinline", "");
          await cam.play().catch(() => {});
          if (await videoReady(800)) return true;
          await stopCam();
        } catch (e) {
          lastErr = e;
        }
      }
      throw lastErr || new Error("Unable to access camera");
    } catch (e) {
      cam.hidden = true;
      fallback.hidden = false;
      showErr("Camera unavailable. You can continue with a placeholder photo.");
      return false;
    }
  }

  async function runCountdown(seconds = 3) {
    countdown.hidden = false;
    countdown.style.display = "flex";
    for (let i = seconds; i >= 1; i--) {
      countdown.textContent = String(i);
      await new Promise((r) => setTimeout(r, 700));
    }
    countdown.hidden = true;
    countdown.style.display = "none";
  }

  function flash() {
    flashEl.classList.add("on");
    setTimeout(() => flashEl.classList.remove("on"), 170);
  }

  function captureLive() {
    return new Promise((resolve, reject) => {
      if (!cam.videoWidth) return reject(new Error("Camera is not ready yet."));
      canvas.width = cam.videoWidth;
      canvas.height = cam.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(cam, 0, 0);
      ctx.restore();
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Capture failed.")), "image/jpeg", 0.94);
    });
  }

  async function frameOverlay(blob) {
    try {
      const img = await createImageBitmap(blob);
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const W = c.width;
      const H = c.height;
      const scale = W / 1080;
      ctx.strokeStyle = "#F3E6D0";
      ctx.lineWidth = 16 * scale;
      ctx.strokeRect(18 * scale, 18 * scale, W - 36 * scale, H - 36 * scale);
      ctx.fillStyle = "rgba(61,16,24,0.55)";
      ctx.fillRect(0, H - 140 * scale, W, 140 * scale);
      ctx.fillStyle = "#F3E6D0";
      ctx.textAlign = "center";
      ctx.font = `700 ${Math.round(36 * scale)}px "Cormorant Garamond", Georgia, serif`;
      ctx.fillText("RPB LAW FIRM", W / 2, H - 78 * scale);
      ctx.font = `600 ${Math.round(18 * scale)}px Oswald, sans-serif`;
      ctx.fillText("URBAN GOLF WEEKEND  ·  EDEN ROC  ·  SEP 5 2026", W / 2, H - 40 * scale);
      return await new Promise((res) => c.toBlob((b) => res(b || blob), "image/jpeg", 0.94));
    } catch (_) {
      return blob;
    }
  }

  async function generateGuestImage(blob) {
    if (!state.health?.openai) return blob;
    showErr("Creating your Urban Golf portrait…");
    try {
      const fd = new FormData();
      fd.append("image", blob, "capture.jpg");
      const r = await fetch("/api/banana", { method: "POST", body: fd });
      const ctype = r.headers.get("content-type") || "";
      if (!r.ok) return blob;
      if (ctype.includes("application/json")) {
        showErr("");
        return blob;
      }
      const polished = await r.blob();
      if (!polished || !polished.size) return blob;
      showErr("");
      return polished;
    } catch (_) {
      showErr("");
      return blob;
    }
  }

  function showStill(blob) {
    if (state.photoUrl) URL.revokeObjectURL(state.photoUrl);
    state.photoUrl = URL.createObjectURL(blob);
    preview.src = state.photoUrl;
    preview.hidden = false;
    cam.hidden = true;
    fallback.hidden = true;
  }

  async function take({ placeholder = false } = {}) {
    clearErr();
    const btn = $("#boothCapture");
    btn.disabled = true;
    try {
      let blob;
      if (placeholder || !stream) {
        blob = await placeholderBlob();
        state.usedPlaceholder = true;
      } else {
        await runCountdown(3);
        flash();
        blob = await captureLive();
        state.usedPlaceholder = false;
      }
      blob = await generateGuestImage(blob);
      blob = await frameOverlay(blob);
      state.photoBlob = blob;
      showStill(blob);
      await stopCam();
      goBall();
    } catch (e) {
      showErr(e.message || "Could not capture. Try the placeholder.");
    } finally {
      btn.disabled = false;
    }
  }

  return { start, stopCam, take, placeholderBlob };
})();

function goBall() {
  if (!state.printLine) state.printLine = "";
  $("#printLine").value = state.printLine;
  $("#printStatus").textContent = "";
  drawGolfBall(state.printLine);
  showScreen("screenBall");
}

async function printBall() {
  const line = ($("#printLine").value || "").trim().slice(0, 12);
  if (!line) {
    $("#printStatus").textContent = "Enter a short print line (up to 12 characters).";
    $("#printLine").focus();
    return;
  }
  state.printLine = line;
  state.printQueueId = queueId();
  state.printed = true;
  drawGolfBall(line);
  $("#printStatus").textContent = `Simulated print queued · ${state.printQueueId}`;
  const btn = $("#printBall");
  btn.disabled = true;
  btn.textContent = "Queued";
  await new Promise((r) => setTimeout(r, 700));
  btn.disabled = false;
  btn.textContent = "Print ball";
  showScreen("screenLead");
}

async function blobToBase64(blob) {
  const arr = await blob.arrayBuffer();
  let bin = "";
  const bytes = new Uint8Array(arr);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

async function maybeEmailPhoto(name, email) {
  if (!state.health?.smtp || !state.photoBlob) {
    return { emailed: false, reason: state.health?.smtp ? "no-photo" : "smtp-not-configured" };
  }
  try {
    const imageBase64 = await blobToBase64(state.photoBlob);
    const r = await fetch("/api/send-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        email,
        filename: "rpb-urban-golf-weekend.jpg",
        mimeType: state.photoBlob.type || "image/jpeg",
        imageBase64,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (data.emailed) return { emailed: true, reason: "sent" };
    return { emailed: false, reason: data.reason || "skipped" };
  } catch (_) {
    return { emailed: false, reason: "send-failed" };
  }
}

async function submitLead(ev) {
  ev.preventDefault();
  const err = $("#leadErr");
  err.textContent = "";

  const name = $("#nameInput").value.trim();
  const company = $("#companyInput").value.trim();
  const email = $("#emailInput").value.trim();
  const role = $("#roleInput").value.trim();
  const needHelp = ($$("input[name=needHelp]").find((el) => el.checked) || {}).value || "";
  const needHelpOther = $("#needHelpOther").value.trim();
  const consent = $("#consentCheck").checked;

  if (!name) { err.textContent = "Please enter your name."; return; }
  if (!company) { err.textContent = "Please enter your company."; return; }
  if (!isEmail(email)) { err.textContent = "Please enter a valid email."; return; }
  if (!role) { err.textContent = "Please enter your role."; return; }
  if (!needHelp) { err.textContent = "Please choose what you need help with."; return; }
  if (needHelp === "other" && !needHelpOther) {
    err.textContent = "Please describe what you need help with.";
    return;
  }
  if (!consent) { err.textContent = "Consent is required to capture this assessment."; return; }
  if (!state.printed || !state.printQueueId) {
    err.textContent = "Please print a ball preview first.";
    return;
  }

  const btn = $("#leadSubmit");
  btn.disabled = true;
  btn.textContent = "Saving…";

  const payload = {
    name,
    company,
    email,
    role,
    needHelp,
    needHelpOther,
    consent: true,
    printLine: state.printLine,
    printQueueId: state.printQueueId,
  };

  try {
    const res = await fetch("/api/lead", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch (_) { data = { raw: text }; }
    if (!res.ok || !data.ok) {
      throw new Error(data.raw || text || "Lead capture failed");
    }
    const photo = await maybeEmailPhoto(name, email);
    state.lastLead = { ...payload, id: data.id, emailed: photo.emailed, emailReason: photo.reason };
    $("#thanksLede").textContent = `Thanks, ${name}. Your ${needHelp === "other" ? needHelpOther : needHelp} assessment is in.`;
    const recap = photo.emailed
      ? `Portrait emailed to ${email}. Print queue ${state.printQueueId}.`
      : `Lead saved. Photo email skipped (${photo.reason}). Print queue ${state.printQueueId}.`;
    $("#thanksMeta").textContent = recap;
    showScreen("screenThanks");
  } catch (e) {
    err.textContent = e.message || "Could not save this assessment. Try again.";
  } finally {
    btn.disabled = false;
    btn.textContent = "Submit assessment";
  }
}

function resetToAttract() {
  booth.stopCam();
  if (state.photoUrl) {
    URL.revokeObjectURL(state.photoUrl);
    state.photoUrl = null;
  }
  state.photoBlob = null;
  state.usedPlaceholder = false;
  state.printLine = "";
  state.printQueueId = "";
  state.printed = false;
  state.lastLead = null;
  $("#leadForm")?.reset();
  $("#leadErr").textContent = "";
  $("#boothErr").textContent = "";
  $("#printLine").value = "";
  $("#printStatus").textContent = "";
  $("#otherWrap").hidden = true;
  $("#boothPreview").hidden = true;
  showScreen("screenAttract");
}

function syncOtherField() {
  const other = $$("input[name=needHelp]").find((el) => el.checked)?.value === "other";
  $("#otherWrap").hidden = !other;
}

async function boot() {
  try {
    const res = await fetch("/api/health", { cache: "no-store" });
    state.health = await res.json();
  } catch (_) {
    state.health = { ok: false, openai: false, smtp: false };
  }

  drawGolfBall("");
  showScreen("screenAttract");

  $("#attractStart").addEventListener("click", async () => {
    showScreen("screenBooth");
    await booth.start();
  });
  $("#boothCapture").addEventListener("click", () => booth.take({ placeholder: false }));
  $("#boothSkip").addEventListener("click", () => booth.take({ placeholder: true }));
  $("#printLine").addEventListener("input", (e) => {
    const v = e.target.value.slice(0, 12);
    e.target.value = v;
    state.printLine = v;
    drawGolfBall(v);
  });
  $("#printBall").addEventListener("click", printBall);
  $("#leadForm").addEventListener("submit", submitLead);
  $$("input[name=needHelp]").forEach((el) => el.addEventListener("change", syncOtherField));
  $("#thanksReset").addEventListener("click", resetToAttract);

  (function attachOSKWhenReady(tries) {
    if (window.OSK && typeof window.OSK.attach === "function") {
      window.OSK.attach({
        targets: ["#printLine", "#nameInput", "#companyInput", "#emailInput", "#roleInput", "#needHelpOther"],
        lang: "en",
        onSubmit: () => document.getElementById("leadSubmit")?.click(),
      });
      return;
    }
    if (tries > 0) setTimeout(() => attachOSKWhenReady(tries - 1), 80);
  })(40);
}

if (document.readyState !== "loading") boot();
else window.addEventListener("DOMContentLoaded", boot);
