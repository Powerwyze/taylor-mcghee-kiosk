const crypto = require("node:crypto");

function normalizeUsPhone(input) {
  let digits = String(input || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) digits = digits.slice(1);
  if (digits.length !== 10) return "";
  if (digits[0] === "0" || digits[0] === "1") return "";
  if (digits[3] === "0" || digits[3] === "1") return "";
  return digits;
}

function pepper() {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.PHONE_PEPPER || "rpb-legacycon-phone";
}

function hashPhone(digits) {
  return crypto.createHmac("sha256", pepper()).update(digits).digest("hex");
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function sameHex(a, b) {
  const left = Buffer.from(String(a || ""), "utf8");
  const right = Buffer.from(String(b || ""), "utf8");
  if (left.length !== right.length || left.length === 0) return false;
  return crypto.timingSafeEqual(left, right);
}

function metaKey() {
  return crypto.createHash("sha256").update(`meta:${pepper()}`).digest();
}

function encryptText(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", metaKey(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

function decryptText(payload) {
  const buf = Buffer.from(String(payload || ""), "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", metaKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

module.exports = {
  normalizeUsPhone,
  hashPhone,
  hashToken,
  sameHex,
  encryptText,
  decryptText,
};
