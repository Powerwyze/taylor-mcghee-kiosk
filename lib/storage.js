const crypto = require("node:crypto");
const { encryptText, decryptText } = require("./phone");

function token() {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN || "";
}

function blob() {
  return require("@vercel/blob");
}

function photoId() {
  return crypto.randomBytes(9).toString("base64url");
}

function leadId() {
  return crypto.randomBytes(12).toString("base64url");
}

function secretName() {
  return crypto.randomBytes(18).toString("base64url");
}

async function putBytes(pathname, body, contentType) {
  const key = token();
  if (!key) throw new Error("blob-not-configured");
  const json = contentType.includes("json");
  return blob().put(pathname, body, {
    access: "public",
    token: key,
    contentType,
    addRandomSuffix: false,
    cacheControlMaxAge: json ? 0 : 60 * 60 * 24 * 7,
  });
}

async function findByPrefix(prefix) {
  const key = token();
  if (!key) return null;
  const found = await blob().list({ prefix, token: key, limit: 5 });
  return (found.blobs || []).find((item) => item.pathname === prefix) || found.blobs?.[0] || null;
}

async function readJson(prefix) {
  const item = await findByPrefix(prefix);
  if (!item?.url) return null;
  const response = await fetch(`${item.url}${item.url.includes("?") ? "&" : "?"}v=${Date.now()}`, { cache: "no-store" });
  if (!response.ok) return null;
  return response.json();
}

async function savePhotoRecord({ id, jpeg, phoneHash, look }) {
  const imagePath = `i/${secretName()}.jpg`;
  const image = await putBytes(imagePath, jpeg, "image/jpeg");
  const meta = {
    id,
    phoneHash,
    look: look || "",
    attempts: 0,
    tokenHash: "",
    tokenExp: 0,
    imageUrlEnc: encryptText(image.url),
    createdAt: new Date().toISOString(),
  };
  await putBytes(`m/${id}.json`, JSON.stringify(meta), "application/json");
  return { id, store: "blob:rpb-legacycon" };
}

async function loadMeta(id) {
  if (!/^[A-Za-z0-9_-]{8,40}$/.test(id || "")) return null;
  return readJson(`m/${id}.json`);
}

async function writeMeta(id, meta) {
  await putBytes(`m/${id}.json`, JSON.stringify(meta), "application/json");
}

async function readImageForMeta(meta) {
  const url = decryptText(meta.imageUrlEnc);
  const response = await fetch(url);
  if (!response.ok) throw new Error("image-fetch-failed");
  return Buffer.from(await response.arrayBuffer());
}

async function saveLead(record) {
  const id = record.id || leadId();
  const body = encryptText(JSON.stringify({ ...record, id }));
  await putBytes(`leads/${id}.json`, JSON.stringify({ v: 1, payload: body }), "application/json");
  console.log("LEAD", JSON.stringify({
    id,
    event: record.event,
    look: record.look,
    sms_consent: record.sms_consent,
    sms_consent_at: record.sms_consent_at,
    sms_consent_version: record.sms_consent_version,
    hasEmail: Boolean(record.email),
    photoId: record.photoId,
    store: "blob:rpb-legacycon/leads",
  }));
  return { id, stored: true, store: "blob:rpb-legacycon/leads" };
}

function storageKind() {
  return token() ? "blob:rpb-legacycon" : "missing";
}

module.exports = {
  photoId,
  leadId,
  savePhotoRecord,
  loadMeta,
  writeMeta,
  readImageForMeta,
  saveLead,
  storageKind,
};
