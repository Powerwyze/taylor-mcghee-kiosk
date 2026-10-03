const { SMS_CONSENT_TEXT, SMS_CONSENT_VERSION } = require("../lib/consent");
const { normalizeUsPhone } = require("../lib/phone");
const { leadId, saveLead } = require("../lib/storage");

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
      if (raw.length > 200000) reject(new Error("too large"));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); }
      catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value || "");

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Method not allowed" }));
  }

  let body;
  try { body = await readJson(req); }
  catch (_) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Invalid JSON" }));
  }

  const name = String(body.firstName || body.name || "").trim().slice(0, 80);
  const phone = normalizeUsPhone(body.phone);
  const email = String(body.email || "").trim().slice(0, 254);
  if (!phone) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Enter a valid 10-digit US mobile number." }));
  }
  if (email && !isEmail(email)) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Email is not valid." }));
  }

  const smsConsent = body.smsConsent === true || body.smsConsent === "true";
  const record = {
    id: leadId(),
    name,
    phone,
    email,
    sms_consent: smsConsent,
    sms_consent_at: new Date().toISOString(),
    sms_consent_version: SMS_CONSENT_VERSION,
    sms_consent_text: SMS_CONSENT_TEXT,
    look: String(body.look || "").slice(0, 40),
    photoId: String(body.photoId || "").slice(0, 40),
    event: "LegacyCon 2026 · BPN Summit",
    source: "rpb-legacycon-kiosk",
    demo: "DEMO-013",
  };

  const saved = await saveLead(record);
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify({ ok: true, leadId: record.id, stored: saved.stored, store: saved.store }));
};
