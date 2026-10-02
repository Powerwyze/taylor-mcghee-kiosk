const { hashToken, sameHex } = require("../lib/phone");
const { loadMeta, readImageForMeta } = require("../lib/storage");

module.exports = async function handler(req, res) {
  const url = new URL(req.url, "https://kiosk.local");
  const id = String(url.searchParams.get("id") || "");
  const token = String(url.searchParams.get("token") || "");
  const meta = token ? await loadMeta(id) : null;
  const fresh = meta && meta.tokenExp > Date.now() && sameHex(hashToken(token), meta.tokenHash || "");
  if (!fresh) {
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
  } catch (_) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "text/plain");
    return res.end("Not found");
  }
};
