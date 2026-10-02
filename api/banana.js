const fs = require("node:fs");
const formidableModule = require("formidable");
const sharp = require("sharp");
const { compositeLogoBand, polishPlainPhoto } = require("../lib/logo-band");
const { normalizeUsPhone, hashPhone } = require("../lib/phone");
const { photoId, savePhotoRecord, saveLead } = require("../lib/storage");
const { sendPortraitEmail } = require("../lib/mail");
const { SMS_CONSENT_TEXT, SMS_CONSENT_VERSION, ASSESSMENT_URL, LEGAL_LINE } = require("../lib/consent");

const formidable = formidableModule.default || formidableModule;
const OPENAI_URL = "https://api.openai.com/v1/images/edits";
const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/images/edits";

const IDENTITY = "Photorealistic photo of the same person or people. Preserve their exact face, skin tone, and do not lighten skin. Keep hair texture, age, and body. Do not beautify or change identity. A professional photographer made this, not a beauty filter and not an illustration. Tasteful and empowering. No stereotypes, no extra people, no logos. Leave the lower floor empty.";

const PROMPTS = {
  agent: `${IDENTITY} Cinematic mission-poster hero for the Black Professionals Network at LegacyCon, an Agent of Legacy. Confident power stance, sharp tailoring, navy #02304A, maroon #681710, and gold light, with a city skyline at dusk. A closed leather briefcase rests at the side. No text.`,
  builder: `${IDENTITY} Black-business-magazine cover celebrating Black excellence, ownership, entrepreneurship, and generational wealth. One coverline only, exactly: Form it. Protect it. Scale it. No awards, no real magazine names, no other text. A signed agreement sits at the edge and does not cover the face. Navy, maroon, and gold light. Leave the lower area empty.`,
  office: `${IDENTITY} The same person owns a corner office and boardroom at golden hour. Warm gold light and a dusk skyline through tall windows. Subtle legacy cues: small framed family photos with unreadable faces, a shelf of books with unreadable spines, a signed business agreement, and a briefcase on the desk. No readable legal text.`,
};

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Expose-Headers", "X-Photo-Id, X-Download-Path, X-RPB-Path, X-RPB-Ms");
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
  const { openaiRequest } = require('../lib/openai-request');
  const fd = new FormData();
  fd.append('model', process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1');
  fd.append('prompt', prompt);
  fd.append('size', process.env.OPENAI_IMAGE_SIZE || '1024x1536');
  fd.append('quality', process.env.OPENAI_IMAGE_QUALITY || 'medium');
  fd.append('n', '1');
  fd.append('image', new Blob([fileBuffer], {type:'image/jpeg'}), 'guest.jpg');
  const signal = AbortSignal.timeout(90000);
  const response = await openaiRequest(OPENAI_URL, {method:'POST', body:fd, signal});
  if (!response.ok) throw Object.assign(new Error('Image provider unavailable'), {code:'OPENAI'});
  const item = (await response.json())?.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, 'base64');
  if (item?.url) {
    const image = await fetch(item.url, {signal});
    if (image.ok) return Buffer.from(await image.arrayBuffer());
  }
  throw Object.assign(new Error('No image returned'), {code:'OPENAI'});
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

  let raw;
  let guest;
  try {
    raw = fs.readFileSync(file.filepath);
    guest = await compressGuest(raw);
  } catch (_) {
    res.statusCode = 400;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: false, error: "Photo could not be read.", code: "READ" }));
  } finally {
    try { fs.unlinkSync(file.filepath); } catch (_) {}
  }

  const started = Date.now();
  let pathUsed = "ai";
  let finalImage;
  try {
    if (field(fields, "forceFallback") === "1") {
      const forced = new Error("forced");
      forced.code = "FORCED";
      throw forced;
    }
    const edited = await editImage({ prompt: PROMPTS[look], fileBuffer: guest });
    finalImage = await compositeLogoBand(edited);
  } catch (error) {
    console.error("portrait ai failed", look, error.code || error.name || "error");
    try {
      finalImage = await compositeLogoBand(await polishPlainPhoto(raw));
      pathUsed = "fallback";
    } catch (fallbackError) {
      console.error("portrait fallback failed", look, fallbackError.message || "fallback");
      res.statusCode = 502;
      res.setHeader("Content-Type", "application/json");
      return res.end(JSON.stringify({
        ok: false,
        error: "The portrait could not be created. Try again.",
        code: "FALLBACK",
      }));
    }
  }

  try {
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
    console.log("portrait", JSON.stringify({ look, path: pathUsed, ms, bytes: finalImage.length, store: "blob" }));
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Photo-Id", id);
    res.setHeader("X-Download-Path", `/p/${id}`);
    res.setHeader("X-RPB-Path", pathUsed);
    res.setHeader("X-RPB-Ms", String(ms));
    return res.end(finalImage);
  } catch (error) {
    console.error("portrait save failed", look, error.message || "save");
    res.statusCode = 502;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      ok: false,
      error: "The portrait could not be created. Try again.",
      code: "SAVE",
    }));
  }
};

module.exports.config = { api: { bodyParser: false } };
