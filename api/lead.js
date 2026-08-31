/**
 * POST /api/lead — business assessment lead capture.
 *
 * JSON: { name, company, email, role, needHelp, needHelpOther, consent,
 *         printLine?, printQueueId?, photoId? }
 *
 * Optional attendee photo email is handled by /api/send-photo.
 * If SMTP / Supabase env is missing, capture still succeeds.
 * Never emails staff (Taylor, info@rpblawfirm.com, or anyone else).
 */

const { createClient } = require("@supabase/supabase-js");

const HELP_IDS = new Set(["ip", "corporate", "litigation", "other"]);
const HELP_LABELS = {
  ip: "IP",
  corporate: "Corporate",
  litigation: "Litigation",
  other: "Other",
};

function setCors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

async function readJson(req) {
  if (req.body && typeof req.body === "object") return req.body;
  return new Promise((resolve, reject) => {
    let raw = "";
    req.setEncoding("utf8");
    req.on("data", (c) => {
      raw += c;
      if (raw.length > 256 * 1024) reject(new Error("Payload too large"));
    });
    req.on("end", () => {
      try { resolve(JSON.parse(raw || "{}")); }
      catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s || "");

function randomId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function supabaseClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

function loadMemory() {
  if (!global.__rpbLeads) global.__rpbLeads = [];
  return global.__rpbLeads;
}

function smtpReady() {
  const user = process.env.WYZER_GMAIL_USER || process.env.GMAIL_USER;
  const pass = process.env.WYZER_APP_PASSWORD || process.env.GOOGLE_APP_PASSWORD;
  return Boolean(user && pass);
}

module.exports = async function handler(req, res) {
  setCors(res);
  if (req.method === "OPTIONS") { res.statusCode = 204; return res.end(); }
  if (req.method !== "POST") { res.statusCode = 405; return res.end("Method not allowed"); }

  let body;
  try { body = await readJson(req); }
  catch (e) {
    res.statusCode = 400;
    return res.end("Invalid JSON: " + e.message);
  }

  const name = String(body.name || "").trim().slice(0, 80);
  const company = String(body.company || "").trim().slice(0, 120);
  const email = String(body.email || "").trim().slice(0, 320);
  const role = String(body.role || "").trim().slice(0, 80);
  const needHelp = String(body.needHelp || "").trim().toLowerCase();
  const needHelpOther = String(body.needHelpOther || "").trim().slice(0, 280);
  const consent = body.consent === true || body.consent === "true";
  const printLine = String(body.printLine || "").trim().slice(0, 12);
  const printQueueId = String(body.printQueueId || "").trim().slice(0, 32);

  if (!name) { res.statusCode = 400; return res.end("Name is required"); }
  if (!company) { res.statusCode = 400; return res.end("Company is required"); }
  if (!isEmail(email)) { res.statusCode = 400; return res.end("Invalid email"); }
  if (!role) { res.statusCode = 400; return res.end("Role is required"); }
  if (!HELP_IDS.has(needHelp)) { res.statusCode = 400; return res.end("Invalid help topic"); }
  if (needHelp === "other" && !needHelpOther) {
    res.statusCode = 400;
    return res.end("Please describe what you need help with");
  }
  if (!consent) { res.statusCode = 400; return res.end("Consent is required"); }

  const id = randomId();
  const record = {
    id,
    name,
    company,
    email,
    role,
    needHelp,
    needHelpLabel: HELP_LABELS[needHelp],
    needHelpOther: needHelp === "other" ? needHelpOther : "",
    consent: true,
    printLine,
    printQueueId,
    createdAt: new Date().toISOString(),
    source: "taylor-mcghee-kiosk",
    event: "Urban Golf Weekend · Eden Roc Miami Beach · Sep 5 2026",
    demo: "DEMO-006",
  };

  const memory = loadMemory();
  memory.push(record);
  if (memory.length > 400) memory.splice(0, memory.length - 400);

  let stored = false;
  const supabase = supabaseClient();
  if (supabase) {
    try {
      const { error } = await supabase.from("rpb_leads").insert({
        id: record.id,
        email: record.email,
        name: record.name,
        company: record.company,
        role: record.role,
        need_help: record.needHelp,
        need_help_other: record.needHelpOther,
        print_line: record.printLine,
        print_queue_id: record.printQueueId,
        consent: true,
        source: record.source,
        event: record.event,
        demo: record.demo,
      });
      if (error) throw error;
      stored = true;
    } catch (e) {
      console.error("supabase insert skipped", e.message || e);
    }
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "application/json");
  return res.end(JSON.stringify({
    ok: true,
    captured: true,
    id,
    stored,
    smtpReady: smtpReady(),
    emailed: false,
    emailReason: "photo-email-is-optional-via-send-photo",
  }));
};
