/**
 * Health — reports which env NAMES are present. Never returns values.
 * Names copied from turespana-imex-kiosk / elevate-photobooth-2.
 * GEMINI_API_KEY is intentionally omitted — this kiosk does not use Gemini.
 */

const NAMES = [
  "OPENAI_API_KEY",
  "OPENAI_IMAGE_MODEL",
  "OPENAI_IMAGE_SIZE",
  "OPENAI_IMAGE_QUALITY",
  "GMAIL_USER",
  "GOOGLE_APP_PASSWORD",
  "WYZER_GMAIL_USER",
  "WYZER_APP_PASSWORD",
  "FROM_NAME",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_BUCKET",
];

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.statusCode = 405;
    return res.end("Method not allowed");
  }
  const present = {};
  for (const name of NAMES) present[name] = Boolean(process.env[name]);
  const smtp = Boolean(
    (process.env.WYZER_GMAIL_USER || process.env.GMAIL_USER) &&
    (process.env.WYZER_APP_PASSWORD || process.env.GOOGLE_APP_PASSWORD)
  );
  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Cache-Control", "no-store");
  return res.end(JSON.stringify({
    ok: true,
    service: "taylor-mcghee-kiosk",
    demo: "DEMO-006",
    mode: "photo-booth+golf-ball+lead",
    event: "Urban Golf Weekend · Eden Roc Miami Beach · Sep 5 2026",
    env: present,
    openai: present.OPENAI_API_KEY,
    smtp,
  }));
};
