const nodemailer = require("nodemailer");

function fromEmail() {
  return (
    process.env.RESEND_FROM ||
    process.env.RESEND_FROM_EMAIL ||
    process.env.EMAIL_FROM ||
    process.env.FROM_EMAIL ||
    ""
  ).trim();
}

function fromName() {
  return process.env.FROM_NAME || "RPB Law Firm";
}

function emailReady() {
  if (process.env.RESEND_API_KEY && fromEmail()) return "resend";
  const user = process.env.WYZER_GMAIL_USER || process.env.GMAIL_USER;
  const pass = process.env.WYZER_APP_PASSWORD || process.env.GOOGLE_APP_PASSWORD;
  if (user && pass) return "gmail";
  return "none";
}

async function sendResend({ to, subject, html, text }) {
  const key = process.env.RESEND_API_KEY;
  const address = fromEmail();
  if (!key || !address) return { ok: false, reason: "resend-not-configured" };
  const payload = {
    from: `${fromName()} <${address}>`,
    to: [to],
    subject,
    html,
    text,
  };
  if (process.env.RESEND_REPLY_TO) payload.reply_to = process.env.RESEND_REPLY_TO;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    console.error("resend status", response.status);
    return { ok: false, reason: "resend-failed" };
  }
  return { ok: true, provider: "resend" };
}

async function sendGmail({ to, subject, html, text }) {
  const user = process.env.WYZER_GMAIL_USER || process.env.GMAIL_USER;
  const pass = process.env.WYZER_APP_PASSWORD || process.env.GOOGLE_APP_PASSWORD;
  if (!user || !pass) return { ok: false, reason: "gmail-not-configured" };
  const transporter = nodemailer.createTransport({ service: "gmail", auth: { user, pass } });
  await transporter.sendMail({
    from: { name: fromName(), address: user },
    to,
    subject,
    text,
    html,
  });
  return { ok: true, provider: "gmail" };
}

async function sendPortraitEmail(options) {
  const channel = emailReady();
  if (channel === "resend") return sendResend(options);
  if (channel === "gmail") return sendGmail(options);
  return { ok: false, reason: "email-not-configured" };
}

module.exports = { emailReady, sendPortraitEmail, fromEmail };
