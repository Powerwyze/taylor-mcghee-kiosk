/**
 * OpenAI image generation for the captured guest portrait.
 * NO Gemini. If OPENAI_API_KEY is missing, return 200 { skipped: true }
 * so the kiosk can keep the captured or placeholder photo.
 *
 * POST multipart/form-data: image (jpeg)
 */

const formidableModule = require("formidable");
const formidable = formidableModule.default || formidableModule;
const fs = require("node:fs");

const OPENAI_URL = "https://api.openai.com/v1/images/edits";

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

const PROMPT = [
  "Create a photorealistic editorial event portrait using the FIRST input photo as the identity reference for the guest.",
  "Make the guest clearly recognizable: preserve their face, skin tone, hair, age, body proportions, and natural expression.",
  "Place that guest as a stylish golfer on a premium rooftop putting green at sunset overlooking Miami Beach and the ocean, matching the supplied Urban Golf Weekend reference direction.",
  "Use warm golden-hour light, vivid blue sky, palm trees, a luxury beachfront hotel skyline, tasteful golf clothing, and a confident approachable event-photo composition.",
  "The guest is the only person in the generated image. Do not add celebrities, invented people, phone numbers, addresses, or unrelated brands.",
  "Include only the exact readable brand text RPB LAW FIRM if any text is rendered; avoid other prominent text or signage.",
  "Portrait 2:3 output, polished but natural, realistic hands and golf equipment, no collage, no illustration, no Gemini styling.",
].join(" ");

async function openaiEdit({ apiKey, model, size, quality, prompt, fileBuffer, mimeType, filename }) {
  const fd = new FormData();
  fd.append("model", model);
  fd.append("prompt", prompt);
  fd.append("size", size);
  fd.append("quality", quality);
  fd.append("n", "1");
  fd.append("image", new Blob([fileBuffer], { type: mimeType || "image/jpeg" }), filename || "input.jpg");

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 280000);
  let openaiRes;
  try {
    openaiRes = await fetch(OPENAI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: fd,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(t);
  }

  if (!openaiRes.ok) {
    const text = await openaiRes.text().catch(() => "");
    const err = new Error(`OpenAI HTTP ${openaiRes.status}: ${text.slice(0, 400)}`);
    err.status = openaiRes.status;
    throw err;
  }

  const data = await openaiRes.json();
  const item = data?.data?.[0];
  if (item?.b64_json) return Buffer.from(item.b64_json, "base64");
  if (item?.url) {
    const r = await fetch(item.url);
    return Buffer.from(await r.arrayBuffer());
  }
  throw new Error("No image data in OpenAI response");
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "POST") { res.statusCode = 405; return res.end("Method not allowed"); }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({ ok: true, skipped: true, reason: "openai-not-configured" }));
  }

  const form = formidable({ multiples: false, maxFileSize: 25 * 1024 * 1024 });
  let files;
  try {
    [, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, f, fl) => (err ? reject(err) : resolve([f, fl])));
    });
  } catch (e) {
    res.statusCode = 400;
    return res.end("Upload error: " + e.message);
  }

  const fileField = files?.image;
  const file = Array.isArray(fileField) ? fileField[0] : fileField;
  if (!file?.filepath) { res.statusCode = 400; return res.end("Missing image upload"); }

  let fileBuffer;
  try { fileBuffer = fs.readFileSync(file.filepath); }
  catch (e) { res.statusCode = 500; return res.end("Failed reading upload: " + e.message); }
  finally {
    try { fs.unlinkSync(file.filepath); } catch (_) {}
  }

  const model = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
  const size = process.env.OPENAI_IMAGE_SIZE || "1024x1536";
  const quality = process.env.OPENAI_IMAGE_QUALITY || "high";
  const mimeType = file.mimetype || "image/jpeg";

  try {
    const buf = await openaiEdit({
      apiKey: openaiKey,
      model,
      size,
      quality,
      prompt: PROMPT,
      fileBuffer,
      mimeType,
      filename: file.originalFilename || "input.jpg",
    });
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-RPB-Provider", "openai");
    return res.end(buf);
  } catch (e) {
    console.error("openai polish skipped", e.message || e);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      ok: true,
      skipped: true,
      reason: "openai-failed",
    }));
  }
};

module.exports.config = {
  api: { bodyParser: false },
};
