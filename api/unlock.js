const crypto = require("node:crypto");
const { normalizeUsPhone, hashPhone, hashToken, sameHex } = require("../lib/phone");
const { loadMeta, writeMeta } = require("../lib/storage");

const FAIL = "That number doesn't match. Try the number you entered at the booth.";
const LOCKED = "Too many tries. Ask someone at the booth for help.";
const MAX_TRIES = 5;

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Cache-Control", "no-store");
}

function readJson(req) {
  if (req.body && typeof req.body === "object") return Promise.resolve(req.body);
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 20000) reject(new Error("too large"));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); }
      catch (error) { reject(error); }
    });
    req.on("error", reject);
  });
}

function reply(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "POST") return reply(res, 405, { ok: false, error: "Method not allowed" });

  let body;
  try { body = await readJson(req); }
  catch (_) { return reply(res, 400, { ok: false, error: FAIL }); }

  const id = String(body.id || "");
  const meta = await loadMeta(id);
  if (!meta?.phoneHash) return reply(res, 404, { ok: false, error: "This portrait link is not valid." });
  if ((meta.attempts || 0) >= MAX_TRIES) return reply(res, 429, { ok: false, error: LOCKED });

  const digits = normalizeUsPhone(body.phone);
  const match = Boolean(digits) && sameHex(hashPhone(digits), meta.phoneHash);
  if (!match) {
    meta.attempts = (meta.attempts || 0) + 1;
    try { await writeMeta(id, meta); }
    catch (error) { console.error("attempt write failed", error.message || "write"); }
    if (meta.attempts >= MAX_TRIES) return reply(res, 429, { ok: false, error: LOCKED });
    return reply(res, 401, { ok: false, error: FAIL });
  }

  const token = crypto.randomBytes(24).toString("base64url");
  meta.tokenHash = hashToken(token);
  meta.tokenExp = Date.now() + 30 * 60 * 1000;
  try { await writeMeta(id, meta); }
  catch (error) {
    console.error("token write failed", error.message || "write");
    return reply(res, 500, { ok: false, error: "The portrait could not be opened. Try again." });
  }
  return reply(res, 200, {
    ok: true,
    token,
    view: `/api/image?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`,
  });
};
