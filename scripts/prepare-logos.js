const fs = require("node:fs");
const path = require("node:path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const srcDir = path.join(root, "public/assets/logos");
const outDirs = [
  path.join(root, "public/assets/logos"),
  path.join(root, "lib/logos"),
];

async function knockout(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r > 242 && g > 242 && b > 242) data[i + 3] = 0;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .trim()
    .png()
    .toBuffer();
}

async function main() {
  const jobs = [
    ["rpb-source.png", "rpb.png", 280],
    ["bpn-source.png", "bpn.png", 220],
    ["powerwyze-source.png", "powerwyze.png", 160],
  ];
  for (const dir of outDirs) fs.mkdirSync(dir, { recursive: true });
  for (const [source, name, height] of jobs) {
    const knocked = await knockout(path.join(srcDir, source));
    const png = await sharp(knocked).resize({ height, fit: "inside" }).png().toBuffer();
    for (const dir of outDirs) fs.writeFileSync(path.join(dir, name), png);
    console.log(name, png.length);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
