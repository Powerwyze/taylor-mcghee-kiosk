const { hashToken, sameHex } = require("../lib/phone");
const { loadMeta, readImageForMeta } = require("../lib/storage");

function param(req, name) {
  const fromQuery = req.query && req.query[name];
  if (Array.isArray(fromQuery) && fromQuery[0]) return String(fromQuery[0]);
  if (typeof fromQuery === "string" && fromQuery) return fromQuery;
  try {
    return String(new URL(req.url || "/", "https://kiosk.local").searchParams.get(name) || "");
  } catch (_) {
    return "";
  }
}

module.exports = async function handler(req, res) {
  const id = param(req, "id");
  const token = param(req, "token");
  let meta = null;
  let fresh = false;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    meta = token ? await loadMeta(id) : null;
    fresh = Boolean(meta && meta.tokenExp > Date.now() && sameHex(hashToken(token), meta.tokenHash || ""));
    if (fresh || !token) break;
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  if (!fresh) {
    const reason = !token ? "no-token" : !meta ? "no-meta" : meta.tokenExp <= Date.now() ? "expired" : "mismatch";
    console.error("image denied", reason, "idLen", id.length, "tokenLen", token.length, "attempts", meta ? meta.attempts : null, "hash", Boolean(meta && meta.tokenHash), "expOk", Boolean(meta && meta.tokenExp > Date.now()));
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "no-store");
    return res.end("Not found");
  }
  try {
    const image = await readImageForMeta(meta);
    res.statusCode = 200;
    res.setHeader("Content-Type", "image/jpeg");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", "inline; filename=\"rpb-legacy-portrait.jpg\"");
    return res.end(image);
  } catch (error) {
    console.error("image read failed", error.message || "read");
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "no-store");
    return res.end("Not found");
  }
};
