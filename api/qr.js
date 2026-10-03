const QRCode = require("qrcode");

module.exports = async function handler(req, res) {
  const url = new URL(req.url, "https://kiosk.local");
  const text = String(url.searchParams.get("text") || "").slice(0, 600);
  if (!/^https:\/\//.test(text)) {
    res.statusCode = 400;
    return res.end("Missing url");
  }
  const png = await QRCode.toBuffer(text, {
    width: 640,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#681710", light: "#FDEED0" },
  });
  res.statusCode = 200;
  res.setHeader("Content-Type", "image/png");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(png);
};
