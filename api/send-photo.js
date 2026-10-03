const { sendPortraitEmail } = require("../lib/mail");
const { ASSESSMENT_URL, LEGAL_LINE } = require("../lib/consent");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function readJson(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 12 * 1024 * 1024) reject(new Error("too large"));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); }
      catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "");
const esc = (value) => String(value || "").replace(/[&<>"']/g, (ch) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[ch]));

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }

  let body;
  try { body = await readJson(req); }
  catch (_) {
    res.statusCode = 400;
    return res.end("Invalid JSON");
  }

  const email = String(body.email || "").trim();
  if (!isEmail(email)) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Invalid email" }));
  }

  const name = String(body.firstName || body.name || "").trim().slice(0, 80);
  const greet = name ? esc(name) : "there";
  const host = process.env.PUBLIC_BASE_URL || "https://rpb-legacycon-kiosk.vercel.app";
  const page = body.photoId ? `${host}/p/${encodeURIComponent(String(body.photoId))}` : host;
  const subject = "Your Legacy Portrait · RPB Law Firm";
  const text = [
    `Thank you, ${name || "there"}.`,
    "",
    "Your Legacy Portrait is on the booth screen. Scan the QR and confirm with the mobile number you entered.",
    page,
    "Post and tag @rpblawfirm for a chance to win a free strategy session.",
    `Take the RPB Business & Brand Assessment: ${ASSESSMENT_URL}`,
    "",
    LEGAL_LINE,
  ].join("\n");
  const html = `<!doctype html><html><body style="margin:0;background:#02304A;color:#FDEED0;font-family:Georgia,serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#02304A;padding:28px 16px">
      <tr><td align="center">
        <table role="presentation" width="560" style="max-width:560px;width:100%;background:#FDEED0;color:#02304A;border-radius:16px">
          <tr><td style="padding:28px 28px 8px;text-align:center">
            <div style="letter-spacing:0.22em;font-size:13px">RPB LAW FIRM</div>
            <h1 style="margin:12px 0 8px;font-size:32px">Your Legacy Portrait</h1>
            <p style="margin:0;font-size:16px;line-height:1.45">Thank you, ${greet}. Scan the booth QR and confirm with the mobile number you entered.</p>
          </td></tr>
          <tr><td style="padding:16px 28px;text-align:center;font-size:16px;line-height:1.45">
            <p>Post and tag @rpblawfirm for a chance to win a free strategy session.</p>
            <p><a href="${ASSESSMENT_URL}" style="color:#681710">Take the RPB Business &amp; Brand Assessment</a></p>
          </td></tr>
          <tr><td style="padding:8px 28px 24px;text-align:center;font-size:12px;line-height:1.4">${esc(LEGAL_LINE)}</td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;

  try {
    const result = await sendPortraitEmail({
      to: email,
      subject,
      html,
      text,
    });
    res.statusCode = result.ok ? 200 : 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: result.ok, emailed: result.ok, provider: result.provider || null, reason: result.reason || null }));
  } catch (error) {
    console.error("email failed", error.message || error);
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, emailed: false, reason: "send-failed" }));
  }
};
