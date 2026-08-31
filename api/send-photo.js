/**
 * Optional photo email to the guest who just captured a portrait.
 *
 * POST JSON: { name, email, filename, mimeType, imageBase64 }
 *
 * Env (names copied from turespana-imex-kiosk):
 *   WYZER_APP_PASSWORD / GOOGLE_APP_PASSWORD
 *   WYZER_GMAIL_USER / GMAIL_USER
 *   FROM_NAME  default: "RPB Law Firm"
 *
 * If SMTP env is missing, return 200 { ok: true, skipped: true }.
 * Never emails staff.
 */

const nodemailer = require("nodemailer");

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 12 * 1024 * 1024) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");
const esc = (s) => String(s || "").replace(/[&<>"']/g, (c) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[c]));

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "POST") { res.statusCode = 405; return res.end("Method not allowed"); }

  let body;
  try { body = await readJson(req); }
  catch (e) { res.statusCode = 400; return res.end("Invalid JSON: " + e.message); }

  const { name, email, filename, mimeType, imageBase64 } = body || {};
  if (!isEmail(email)) { res.statusCode = 400; return res.end("Invalid email"); }
  if (!imageBase64) { res.statusCode = 400; return res.end("Missing imageBase64"); }

  const pass = process.env.WYZER_APP_PASSWORD || process.env.GOOGLE_APP_PASSWORD;
  const user = process.env.WYZER_GMAIL_USER || process.env.GMAIL_USER;
  if (!pass || !user) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: true, skipped: true, reason: "smtp-not-configured" }));
  }

  const fromName = process.env.FROM_NAME || "RPB Law Firm";
  const greetName = name ? esc(name) : "there";

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user, pass },
  });

  const safeFilename = String(filename || "rpb-urban-golf-weekend.jpg")
    .replace(/[^a-z0-9@._-]/gi, "_")
    .slice(0, 200);

  const html = `<!doctype html><html><body style="margin:0;padding:0;font-family:Georgia,'Times New Roman',serif;background:#F3E6D0;color:#5C1A24">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F3E6D0;padding:32px 16px">
      <tr><td align="center">
        <table role="presentation" width="600" style="max-width:600px;width:100%;background:#FFF8EE;border:1px solid #5C1A24;border-radius:4px;overflow:hidden;color:#5C1A24">
          <tr><td style="padding:28px 32px 16px;text-align:center;border-bottom:1px solid rgba(92,26,36,0.18)">
            <div style="font-size:13px;letter-spacing:0.32em;font-weight:700;text-transform:uppercase">RPB LAW FIRM</div>
            <div style="margin-top:10px;font-size:11px;letter-spacing:0.18em;text-transform:uppercase;opacity:0.72">Urban Golf Weekend · Eden Roc Miami Beach · Sep 5 2026</div>
          </td></tr>
          <tr><td style="padding:26px 32px;text-align:center">
            <h1 style="margin:0 0 10px;font-size:26px;font-weight:700;line-height:1.2">Thank you, ${greetName}</h1>
            <p style="margin:0;font-size:15px;line-height:1.55">Your Urban Golf Weekend portrait is attached. We also captured your business assessment at the RPB Law Firm activation.</p>
          </td></tr>
          <tr><td style="padding:0 32px 26px;text-align:center;font-size:12px;letter-spacing:0.08em;opacity:0.7">
            Proclaim.com · Painted by PowerWyze
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;

  const text = [
    `Thank you, ${name || "there"}`,
    "",
    "Your Urban Golf Weekend portrait is attached.",
    "RPB Law Firm · Eden Roc Miami Beach · Sep 5 2026",
    "Proclaim.com",
  ].join("\n");

  try {
    await transporter.sendMail({
      from: { name: fromName, address: user },
      to: email,
      subject: "Your RPB Law Firm Urban Golf Weekend portrait",
      text,
      html,
      attachments: [{
        filename: safeFilename,
        content: Buffer.from(imageBase64, "base64"),
        contentType: mimeType || "image/jpeg",
      }],
    });
  } catch (e) {
    console.error("smtp error", e);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: true, skipped: true, reason: "send-failed" }));
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify({ ok: true, emailed: true }));
};
