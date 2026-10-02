const { emailReady } = require("../lib/mail");
const { storageKind } = require("../lib/storage");

const KEYS = [
  "OPENAI_API_KEY",
  "OPENAI_API_KIOSK_KEY",
  "OPEN_API_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM",
  "RESEND_FROM_EMAIL",
  "EMAIL_FROM",
  "FROM_EMAIL",
  "GMAIL_USER",
  "GOOGLE_APP_PASSWORD",
  "WYZER_GMAIL_USER",
  "WYZER_APP_PASSWORD",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_BUCKET",
  "BLOB_READ_WRITE_TOKEN",
  "NEXT_PUBLIC_SUPABASE_URL",
];

module.exports = async function handler(req, res) {
  const present = {};
  for (const key of KEYS) present[key] = Boolean(process.env[key]);
  const openai = present.OPENAI_API_KEY || present.OPENAI_API_KIOSK_KEY || present.OPEN_API_KEY;
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify({
    ok: true,
    app: "rpb-legacycon-kiosk",
    demo: "DEMO-013",
    openai,
    oidc: Boolean(process.env.VERCEL_OIDC_TOKEN),
    email: emailReady(),
    storage: storageKind(),
    model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
    quality: process.env.OPENAI_IMAGE_QUALITY || "medium",
    size: process.env.OPENAI_IMAGE_SIZE || "1024x1536",
    fromName: process.env.FROM_NAME || "RPB Law Firm",
    present,
  }));
};
