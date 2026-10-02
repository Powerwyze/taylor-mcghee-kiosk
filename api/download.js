const { loadMeta } = require("../lib/storage");
const { ASSESSMENT_URL, LEGAL_LINE } = require("../lib/consent");

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

module.exports = async function handler(req, res) {
  const url = new URL(req.url, "https://kiosk.local");
  const id = String(url.searchParams.get("id") || "");
  const meta = await loadMeta(id);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Referrer-Policy", "no-referrer");
  if (!meta) {
    res.statusCode = 404;
    return res.end("<!doctype html><title>Portrait</title><p>This portrait link is not valid.</p>");
  }
  const safeId = escapeHtml(id);
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="#02304A">
<title>Confirm your portrait · RPB Law Firm</title>
<style>
  body{margin:0;background:#02304A;color:#FDEED0;font-family:Georgia,serif}
  main{max-width:430px;margin:0 auto;padding:28px 18px 48px}
  .brand{letter-spacing:.16em;font-size:13px}
  h1{font-size:34px;line-height:1.05;margin:12px 0}
  p,label{font-size:18px;line-height:1.4}
  input{width:100%;box-sizing:border-box;font-size:22px;padding:14px 12px;border-radius:12px;border:2px solid #F6B146;background:#FDEED0;color:#02304A}
  button,a.btn{display:block;width:100%;box-sizing:border-box;text-align:center;text-decoration:none;background:#F6B146;color:#02304A;font-weight:700;font-size:20px;border:0;border-radius:999px;padding:16px 18px;margin:14px 0}
  .err{color:#F6B146;min-height:1.4em}
  .legal{font-size:13px;opacity:.85}
  img.portrait{width:100%;height:auto;border-radius:16px;background:#FDEED0;display:block}
  #unlocked[hidden]{display:none}
</style>
</head>
<body>
<main>
  <div class="brand">RPB LAW FIRM · LEGACYCON 2026</div>
  <h1>Confirm your number</h1>
  <p>Enter the mobile number you used at the booth to view your portrait.</p>
  <form id="confirm">
    <label for="phone">Mobile number</label>
    <input id="phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" required>
    <p class="err" id="error" role="alert"></p>
    <button type="submit">View my portrait</button>
  </form>
  <section id="unlocked" hidden>
    <img id="portrait" class="portrait" alt="Your Legacy Portrait">
    <a id="save" class="btn" href="#">Download / Save</a>
    <p><strong>Post and tag @rpblawfirm for a chance to win a free strategy session.</strong></p>
    <a class="btn" href="${ASSESSMENT_URL}">Take the RPB Business &amp; Brand Assessment</a>
  </section>
  <p class="legal">${escapeHtml(LEGAL_LINE)}</p>
</main>
<script>
const portraitId = ${JSON.stringify(id)};
const form = document.getElementById("confirm");
const error = document.getElementById("error");
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  error.textContent = "Checking…";
  const response = await fetch("/api/unlock", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: portraitId, phone: document.getElementById("phone").value })
  });
  const data = await response.json().catch(() => ({}));
  if (!data.ok || !data.image) {
    error.textContent = data.error || "That number doesn't match. Try the number you entered at the booth.";
    return;
  }
  const binary = atob(data.image);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
  const img = document.getElementById("portrait");
  img.src = url;
  const save = document.getElementById("save");
  save.href = url;
  save.setAttribute("download", "rpb-legacy-portrait.jpg");
  document.getElementById("unlocked").hidden = false;
  form.hidden = true;
  error.textContent = "";
});
</script>
</body>
</html>`;
  res.statusCode = 200;
  res.end(html);
  void safeId;
};
