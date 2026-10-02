const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const CREAM = "#FDEED0";

function logoPath(name) {
  const bundled = path.join(__dirname, "logos", name);
  if (fs.existsSync(bundled)) return bundled;
  return path.join(process.cwd(), "public", "assets", "logos", name);
}

async function loadLogo(name, height) {
  const file = logoPath(name);
  const buf = await sharp(file).resize({ height, fit: "inside" }).png().toBuffer();
  const meta = await sharp(buf).metadata();
  return { buf, w: meta.width || 1, h: meta.height || 1 };
}

async function compositeLogoBand(imageBuffer) {
  const base = sharp(imageBuffer, { failOn: "none" }).rotate();
  const meta = await base.metadata();
  const width = meta.width || 1024;
  const height = meta.height || 1536;
  const bandH = Math.max(140, Math.round(height * 0.1));
  const logoH = Math.max(72, Math.round(bandH * 0.72));
  let logos = await Promise.all(["rpb.png", "bpn.png", "powerwyze.png"].map((name) => loadLogo(name, logoH)));
  const gap = Math.round(width * 0.035);
  const side = Math.round(width * 0.03);
  let totalW = logos.reduce((sum, logo) => sum + logo.w, 0) + gap * (logos.length - 1);
  const available = width - side * 2;
  if (totalW > available) {
    const scale = available / totalW;
    logos = await Promise.all(["rpb.png", "bpn.png", "powerwyze.png"].map((name) => loadLogo(name, Math.max(48, Math.round(logoH * scale)))));
    totalW = logos.reduce((sum, logo) => sum + logo.w, 0) + gap * (logos.length - 1);
  }
  let x = Math.max(side, Math.round((width - totalW) / 2));
  const composites = logos.map((logo) => {
    const item = { input: logo.buf, left: x, top: Math.round((bandH - logo.h) / 2) };
    x += logo.w + gap;
    return item;
  });
  const band = await sharp({
    create: { width, height: bandH, channels: 4, background: CREAM },
  }).composite(composites).png().toBuffer();

  const portrait = await base.png().toBuffer();
  return sharp({
    create: { width, height: height + bandH, channels: 3, background: CREAM },
  })
    .composite([
      { input: portrait, top: 0, left: 0 },
      { input: band, top: height, left: 0 },
    ])
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
}

module.exports = { compositeLogoBand };
