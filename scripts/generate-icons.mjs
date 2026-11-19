// Builds every icon the project ships from one master file: assets/logo-mark.png
// (the heart-and-aperture mark, transparent background, square canvas).
//
//   npm run generate:icons
//
// Outputs, all overwritten in place:
//   assets/                     Expo app icon, splash, favicon, Android adaptive layers
//   public/icons/               PWA icons, favicon pngs and the iOS home-screen icon
//   public/favicon.ico          16, 32 and 48, from the Android launcher composite
//   android-twa/.../mipmap-*/   Android launcher icons at every density
//   android-twa/play-assets/    Play Console listing graphics
//
// Why a script: the Android adaptive icon alone needs three layers at five
// densities, and each has its own safe zone. Hand-exporting them drifts.

import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const MASTER = "assets/logo-mark.png";

// The app's own cream, from src/components/theme.ts. The master art uses a very
// slightly warmer cream (#FFFAF0); normalising to one value stops the icon from
// showing a faint lighter patch against the splash screen and status bar.
const CREAM = "#F6EFE6";
const CREAM_RGB = { r: 0xf6, g: 0xef, b: 0xe6 };

/** The mark trimmed to its own bounds, with the cream normalised. */
async function markArt() {
  const src = sharp(MASTER).ensureAlpha();
  const { data, info } = await src.raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  for (let i = 0; i < data.length; i += channels) {
    if (data[i + 3] < 8) continue;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    // Creamy = bright and near-neutral. The red is far from this, so it is untouched.
    if (r > 228 && g > 228 && b > 220 && Math.max(r, g, b) - Math.min(r, g, b) < 36) {
      data[i] = CREAM_RGB.r;
      data[i + 1] = CREAM_RGB.g;
      data[i + 2] = CREAM_RGB.b;
    }
  }
  return sharp(data, { raw: { width, height, channels } }).png().trim().toBuffer();
}

/** The red areas only, as a white-on-transparent mask for Android 13 themed icons. */
async function monoArt() {
  const { data, info } = await sharp(MASTER).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);
  for (let p = 0; p < width * height; p += 1) {
    const i = p * channels;
    const [r, g, b, a] = [data[i], data[i + 1], data[i + 2], data[i + 3]];
    const red = a > 24 && r > g + 40 && r > b + 40;
    out[p * 4] = 255;
    out[p * 4 + 1] = 255;
    out[p * 4 + 2] = 255;
    out[p * 4 + 3] = red ? a : 0;
  }
  return sharp(out, { raw: { width, height, channels: 4 } }).png().trim().toBuffer();
}

/**
 * Centres `art` on a square canvas, scaled to `ratio` of the side.
 * ratio 0.667 = Android's adaptive-icon safe zone (72dp of 108dp).
 * ratio 0.80  = the maskable-icon safe zone browsers use.
 */
async function square(art, size, ratio, background) {
  const inner = Math.round(size * ratio);
  const fitted = await sharp(art).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: background ?? { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: fitted, gravity: "center" }])
    .png()
    .toBuffer();
}

const art = await markArt();
const mono = await monoArt();

// ---- Expo / app assets ------------------------------------------------------
await sharp(await square(art, 1024, 0.82, CREAM_RGB)).toFile("assets/icon.png");
await sharp(await square(art, 1024, 0.78)).toFile("assets/splash-icon.png");
await sharp(await square(art, 512, 0.667)).toFile("assets/android-icon-foreground.png");
await sharp(await square(mono, 432, 0.667)).toFile("assets/android-icon-monochrome.png");
await sharp({ create: { width: 512, height: 512, channels: 4, background: CREAM_RGB } })
  .png()
  .toFile("assets/android-icon-background.png");

// Web icons match the Android launcher: the adaptive foreground stacked on the
// adaptive background, which is the square Android shows (the OEM mask only
// clips cream corners). Sized down from that composite.
async function androidLauncher(size) {
  const background = await sharp("assets/android-icon-background.png").resize(size, size).png().toBuffer();
  const foreground = await sharp("assets/android-icon-foreground.png").resize(size, size, { fit: "fill" }).png().toBuffer();
  return sharp(background).composite([{ input: foreground, gravity: "centre" }]).png().toBuffer();
}

function icoFromPngs(images) {
  const count = images.length;
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(count, 4);
  let offset = 6 + count * 16;
  const entries = images.map((image) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(image.size >= 256 ? 0 : image.size, 0);
    entry.writeUInt8(image.size >= 256 ? 0 : image.size, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += image.png.length;
    return entry;
  });
  return Buffer.concat([head, ...entries, ...images.map((image) => image.png)]);
}

const launcher = await androidLauncher(512);
await mkdir("public/icons", { recursive: true });
await sharp(launcher).resize(48, 48).png().toFile("assets/favicon.png");
const webSizes = [
  ["public/icons/favicon-16.png", 16],
  ["public/icons/favicon-32.png", 32],
  ["public/icons/apple-touch-icon.png", 180],
  ["public/icons/icon-192.png", 192],
  ["public/icons/icon-512.png", 512],
  ["public/icons/maskable-192.png", 192],
  ["public/icons/maskable-512.png", 512],
];
const pngs = {};
for (const [file, size] of webSizes) {
  const png = await sharp(launcher).resize(size, size).png().toBuffer();
  pngs[size] = png;
  await writeFile(file, png);
}
const icoImages = [];
for (const size of [16, 32, 48]) {
  const png = size === 48 ? await sharp(launcher).resize(48, 48).png().toBuffer() : pngs[size];
  icoImages.push({ size, png });
}
await writeFile("public/favicon.ico", icoFromPngs(icoImages));

// ---- Android launcher icons -------------------------------------------------
const RES = "android-twa/app/src/main/res";
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [name, scale] of Object.entries(densities)) {
  const dir = `${RES}/mipmap-${name}`;
  await mkdir(dir, { recursive: true });
  const layer = Math.round(108 * scale);

  await sharp(await square(art, layer, 0.667)).toFile(`${dir}/ic_launcher_foreground.png`);
  await sharp(await square(mono, layer, 0.667)).toFile(`${dir}/ic_launcher_monochrome.png`);
  await sharp({ create: { width: layer, height: layer, channels: 4, background: CREAM_RGB } })
    .png()
    .toFile(`${dir}/ic_launcher_background.png`);

  // Legacy square and round icons for Android 7 (API 24-25), which has no adaptive icons.
  const legacy = Math.round(48 * scale);
  const flat = await square(art, legacy, 0.78, CREAM_RGB);
  await sharp(flat).toFile(`${dir}/ic_launcher.png`);
  const circle = Buffer.from(
    `<svg width="${legacy}" height="${legacy}"><circle cx="${legacy / 2}" cy="${legacy / 2}" r="${legacy / 2}" fill="#fff"/></svg>`,
  );
  await sharp(flat).composite([{ input: circle, blend: "dest-in" }]).png().toFile(`${dir}/ic_launcher_round.png`);

  // Splash drawable: 192dp is the size Android's splash screen API expects.
  await mkdir(`${RES}/drawable-${name}`, { recursive: true });
  await sharp(await square(art, Math.round(192 * scale), 0.68)).toFile(`${RES}/drawable-${name}/splash_logo.png`);
}

// ---- Play Console listing ---------------------------------------------------
await mkdir("android-twa/play-assets", { recursive: true });
await sharp(await square(art, 512, 0.78, CREAM_RGB)).toFile("android-twa/play-assets/play-icon-512.png");

const banner = await sharp(art).resize(300, 300, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
await sharp({ create: { width: 1024, height: 500, channels: 4, background: CREAM_RGB } })
  .composite([{ input: banner, left: 362, top: 100 }])
  .png()
  .toFile("android-twa/play-assets/feature-graphic-1024x500.png");

console.log("icons generated from", MASTER);
