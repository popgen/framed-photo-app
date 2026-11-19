import { writeFileSync } from "node:fs";
import sharp from "sharp";

const framePath = "assets/frames/wood-15.png";
const photoPath = "assets/sample-memory.png";

const framed = await framedPhoto(540);
const logoFramed = await framedPhoto(360);

const og = await sharp({
  create: { width: 1200, height: 630, channels: 4, background: "#F6EFE6" },
})
  .composite([
    { input: await stripe(), left: 0, top: 0 },
    { input: framed.photo, left: 64 + framed.hole.left, top: 45 + framed.hole.top },
    { input: framed.image, left: 64, top: 45 },
    { input: textSvg(), left: 0, top: 0 },
  ])
  .png({ compressionLevel: 9 })
  .toBuffer();

const logo = await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#F6EFE6" },
})
  .composite([
    { input: logoFramed.photo, left: 76 + logoFramed.hole.left, top: 28 + logoFramed.hole.top },
    { input: logoFramed.image, left: 76, top: 28 },
    {
      input: Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
          <text x="256" y="468" text-anchor="middle" font-family="Georgia, serif" font-size="54" fill="#241714">Mi Fotito</text>
        </svg>`,
      ),
      left: 0,
      top: 0,
    },
  ])
  .png({ compressionLevel: 9 })
  .toBuffer();

writeFileSync("public/og.png", og);
writeFileSync("public/logo.png", logo);

const ogMeta = await sharp(og).metadata();
const logoMeta = await sharp(logo).metadata();
if (ogMeta.width !== 1200 || ogMeta.height !== 630) throw new Error(`og.png es ${ogMeta.width}x${ogMeta.height}`);
if (logoMeta.width !== 512 || logoMeta.height !== 512) throw new Error(`logo.png es ${logoMeta.width}x${logoMeta.height}`);

async function framedPhoto(height) {
  const resized = await sharp(framePath).resize({ height }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = resized;
  const out = Buffer.from(data);
  let minX = info.width;
  let minY = info.height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < info.height; y += 1) {
    for (let x = 0; x < info.width; x += 1) {
      const i = (y * info.width + x) * 4;
      if (data[i] < 18 && data[i + 1] < 18 && data[i + 2] < 18) {
        out[i + 3] = 0;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const hole = { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
  const photo = await sharp(photoPath).resize(hole.width, hole.height, { fit: "cover", position: "centre" }).png().toBuffer();
  const image = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  return { image, photo, hole };
}

function stripe() {
  return sharp({
    create: { width: 18, height: 630, channels: 4, background: "#C5363C" },
  })
    .png()
    .toBuffer();
}

function textSvg() {
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <text x="650" y="250" font-family="Georgia, 'Times New Roman', serif" font-size="78" fill="#241714">Mi Fotito</text>
    <text x="650" y="318" font-family="Georgia, 'Times New Roman', serif" font-size="32" fill="#6E564C">Fotos enmarcadas en Lima, Perú</text>
    <text x="650" y="372" font-family="Georgia, 'Times New Roman', serif" font-size="28" fill="#8C2429">Regalos de Navidad con tu foto</text>
  </svg>`);
}
