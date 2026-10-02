const fs = require("node:fs");
const formidableModule = require("formidable");
const sharp = require("sharp");
const { compositeLogoBand } = require("../lib/logo-band");
const { normalizeUsPhone, hashPhone } = require("../lib/phone");
const { photoId, savePhotoRecord, saveLead } = require("../lib/storage");
const { sendPortraitEmail } = require("../lib/mail");
const { SMS_CONSENT_TEXT, SMS_CONSENT_VERSION, ASSESSMENT_URL, LEGAL_LINE } = require("../lib/consent");

const formidable = formidableModule.default || formidableModule;
const OPENAI_URL = "https://api.openai.com/v1/images/edits";
const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/images/edits";

const PROMPTS = {
  agent: "Photorealistic photo of the same person or people. Preserve their exact face, skin tone, hair, age, and body. Do not beautify or change identity. Sharp dark tailoring on a cinematic mission-poster set with oxblood and gold light. No text, no logos, no extra people. Leave the lower floor empty.",
  builder: "Photorealistic business-magazine cover of the same person or people. Preserve their exact face, skin tone, hair, age, and body. Do not beautify. One coverline only, exactly: Form it. Protect it. Scale it. No awards, no press logos, no other text. Leave the lower area empty.",
  office: "Photorealistic photo of the same person or people in a corner office at golden hour. Preserve their exact face, skin tone, hair, age, and body. Do not beautify. Tall windows and warm light. No text, no logos, no extra people. Leave the lower floor empty.",
};

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Expose-Headers", "X-Photo-Id, X-Download-Path");
}

function field(fields, name) {
  const value = fields?.[name];
  return String(Array.isArray(value) ? value[0] : value || "");
}

async function compressGuest(buffer) {
  let quality = 82;
  let out = await sharp(buffer, { failOn: "none" })
    .rotate()
    .resize({ width: 1024, height: 1536, fit: "inside" })
    .jpeg({ quality, mozjpeg: true })
    .toBuffer();
  while (out.length > 550 * 1024 && quality > 52) {
    quality -= 8;
    out = await sharp(buffer, { failOn: "none" })
      .rotate()
      .resize({ width: 1024, height: 1536, fit: "inside" })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
  }
  return out;
}

async function editImage({ prompt, fileBuffer }) {
  const directKey = process.env.OPENAI_API_KEY || process.env.OPENAI_API_KIOSK_KEY || process.env.OPEN_API_KEY || "";
  const oidc = process.env.VERCEL_OIDC_TOKEN || "";
  const size = process.env.OPENAI_IMAGE_SIZE || "1024x1536";
  const quality = process.env.OPENAI_IMAGE_QUALITY || "medium";
  const attempts = [];
  if (directKey) {
    attempts.push({
      url: OPENAI_URL,
      key: directKey,
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
    });
  }
  if (oidc) {
    attempts.push({
      url: GATEWAY_URL,
      key: oidc,
      model: "openai/gpt-image-1",
    });
  }
  if (!attempts.length) {
    const error = new Error("no-image-key");
    error.code = "NO_KEY";
    throw error;
  }

  let last = null;
  for (const attempt of attempts) {
    const fd = new FormData();
    fd.append("model", attempt.model);
    fd.append("prompt", prompt);
    fd.append("size", size);
    fd.append("quality", quality);
    fd.append("n", "1");
    fd.append("image", new Blob([fileBuffer], { type: "image/jpeg" }), "guest.jpg");
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 150000);
    try {
      const response = await fetch(attempt.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${attempt.key}` },
        body: fd,
        signal: controller.signal,
      });
      if (!response.ok) {
        last = `status ${response.status}`;
        console.error("image edit failed", response.status);
        continue;
      }
      const data = await response.json();
      const item = data?.data?.[0];
      if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
      if (item?.url) {
        const image = await fetch(item.url);
        return Buffer.from(await image.arrayBuffer());
      }
      last = "empty";
    } catch (error) {
      last = error.name || "fetch";
      console.error("image edit error", error.name || "fetch");
    } finally {
      clearTimeout(timer);
    }
  }
  const error = new Error(last || "openai");
  error.code = "OPENAI";
  throw error;
}

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

  const form = formidable({ multiples: false, maxFileSize: 20 * 1024 * 1024 });
  let fields;
  let files;
  try {
    [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (error, parsedFields, parsedFiles) => (error ? reject(error) : resolve([parsedFields, parsedFiles])));
    });
  } catch (_) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Upload failed.", code: "UPLOAD" }));
  }

  const phone = normalizeUsPhone(field(fields, "phone"));
  if (!phone) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Enter a valid 10-digit US mobile number.", code: "PHONE" }));
  }

  const lookRaw = field(fields, "look");
  const look = PROMPTS[lookRaw] ? lookRaw : "agent";
  const firstName = field(fields, "firstName").trim().slice(0, 80);
  const email = field(fields, "email").trim().slice(0, 254);
  const smsConsent = field(fields, "smsConsent") === "true";
  const fileField = files?.image;
  const file = Array.isArray(fileField) ? fileField[0] : fileField;
  if (!file?.filepath) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Missing photo.", code: "NO_IMAGE" }));
  }

  let guest;
  try {
    guest = await compressGuest(fs.readFileSync(file.filepath));
  } catch (_) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Photo could not be read.", code: "READ" }));
  } finally {
    try { fs.unlinkSync(file.filepath); } catch (_) {}
  }

  const started = Date.now();
  try {
    const edited = await editImage({ prompt: PROMPTS[look], fileBuffer: guest });
    const finalImage = await compositeLogoBand(edited);
    const id = photoId();
    await savePhotoRecord({ id, jpeg: finalImage, phoneHash: hashPhone(phone), look });
    const consentAt = new Date().toISOString();
    try {
      await saveLead({
        name: firstName,
        phone,
        email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : "",
        sms_consent: smsConsent,
        sms_consent_at: consentAt,
        sms_consent_version: SMS_CONSENT_VERSION,
        sms_consent_text: SMS_CONSENT_TEXT,
        look,
        photoId: id,
        event: "LegacyCon 2026 · BPN Summit",
        source: "rpb-legacycon-kiosk",
        demo: "DEMO-013",
      });
    } catch (error) {
      console.error("lead save failed", error.message || "lead");
    }

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      sendPortraitEmail({
        to: email,
        subject: "Your Legacy Portrait · RPB Law Firm",
        text: `Your Legacy Portrait is on the booth screen. Scan the QR and confirm with the mobile number you entered.\nPost and tag @rpblawfirm for a chance to win a free strategy session.\n${ASSESSMENT_URL}\n${LEGAL_LINE}`,
        html: `<p>Your Legacy Portrait is on the booth screen. Scan the QR and confirm with the mobile number you entered.</p><p>Post and tag @rpblawfirm for a chance to win a free strategy session.</p><p><a href="${ASSESSMENT_URL}">Take the RPB Business &amp; Brand Assessment</a></p><p>${LEGAL_LINE}</p>`,
      }).catch((error) => console.error("optional email failed", error.message || "email"));
    }

    const ms = Date.now() - started;
    console.log("portrait", JSON.stringify({ look, ms, bytes: finalImage.length, store: "blob" }));
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Photo-Id", id);
    res.setHeader("X-Download-Path", `/p/${id}`);
    res.setHeader("X-RPB-Ms", String(ms));
    return res.end(finalImage);
  } catch (error) {
    console.error("portrait failed", look, error.code || error.name || "error");
    const missing = error.code === "NO_KEY";
    res.statusCode = missing ? 503 : 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      ok: false,
      error: missing ? "The portrait service is not configured." : "The portrait could not be created. Try again.",
      code: error.code || "OPENAI",
    }));
  }
};

module.exports.config = { api: { bodyParser: false } };
