import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { christmasSvg } from "./christmas-art.mjs";

const root = path.resolve(import.meta.dirname, "..");
const frames = JSON.parse(await readFile(path.join(root, "data/frames.json"), "utf8"));
const outDir = path.join(root, "assets/frames");
await mkdir(outDir, { recursive: true });

const materials = {
  black: ["#3c3c3c", "#141414", "#2a2a2a", "#6a6a6a", "#050505"],
  white: ["#ffffff", "#f4efe8", "#e3dbd1", "#ffffff", "#cfc6bb"],
  wood: ["#f2d2a4", "#c48445", "#7b4e2b", "#f8e6c8", "#4a2e18"],
  gold: ["#ffe7a6", "#e2b44a", "#9a7428", "#fff6d4", "#6d5420"],
};

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function frameSvg(frame) {
  const W = 1000;
  const H = Math.round((W * frame.outerHcm) / frame.outerWcm);
  const mouldX = (frame.mouldingCm / frame.outerWcm) * W;
  const mouldY = (frame.mouldingCm / frame.outerHcm) * H;
  const ox = ((frame.outerWcm - frame.printWcm) / 2 / frame.outerWcm) * W;
  const oy = ((frame.outerHcm - frame.printHcm) / 2 / frame.outerHcm) * H;
  const ow = (frame.printWcm / frame.outerWcm) * W;
  const oh = (frame.printHcm / frame.outerHcm) * H;
  const [c0, c1, c2, lip, edge] = materials[frame.material];
  const rand = mulberry32(frame.sort * 997 + frame.name.length * 13);
  let grain = "";
  if (frame.material === "wood") {
    const bands = [
      { y0: 3, y1: Math.max(4, mouldY - 3), x0: 0, x1: W },
      { y0: H - mouldY + 3, y1: H - 3, x0: 0, x1: W },
      { y0: mouldY, y1: H - mouldY, x0: 2, x1: Math.max(3, mouldX - 2) },
      { y0: mouldY, y1: H - mouldY, x0: W - mouldX + 2, x1: W - 2 },
    ];
    const lines = [];
    for (const band of bands) {
      const horizontal = band.x1 - band.x0 > band.y1 - band.y0;
      const count = horizontal ? 18 : 10;
      for (let i = 0; i < count; i += 1) {
        const stroke = `rgba(90, 48, 22, ${0.12 + rand() * 0.22})`;
        const width = 0.6 + rand() * 1.3;
        if (horizontal) {
          const y = band.y0 + rand() * (band.y1 - band.y0);
          const amp = Math.min(2.2, (band.y1 - band.y0) * 0.18);
          lines.push(
            `<path d="M${band.x0} ${y} C ${band.x0 + (band.x1 - band.x0) * 0.3} ${y + amp}, ${band.x0 + (band.x1 - band.x0) * 0.7} ${y - amp}, ${band.x1} ${y}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`,
          );
        } else {
          const x = band.x0 + rand() * (band.x1 - band.x0);
          lines.push(
            `<path d="M${x} ${band.y0} C ${x + 1.5} ${(band.y0 + band.y1) / 2}, ${x - 1.5} ${(band.y0 + band.y1) / 2}, ${x} ${band.y1}" fill="none" stroke="${stroke}" stroke-width="${width}"/>`,
          );
        }
      }
    }
    grain = lines.join("");
  }
  const hanger = frame.hanging
    ? `<polygon points="${W / 2 - 14},${mouldY * 0.18} ${W / 2 + 14},${mouldY * 0.18} ${W / 2},${mouldY * 0.72}" fill="#d5d5d5" stroke="#8d8d8d" stroke-width="2"/>`
    : "";
  const mat = frame.mat
    ? `<path fill="#f7f4ef" fill-rule="evenodd" d="M${mouldX} ${mouldY} H${W - mouldX} V${H - mouldY} H${mouldX} Z M${ox} ${oy} H${ox + ow} V${oy + oh} H${ox} Z"/>
       <rect x="${ox}" y="${oy}" width="${ow}" height="${oh}" fill="none" stroke="#e4ddd4" stroke-width="10"/>
       <rect x="${ox + 6}" y="${oy + 6}" width="${ow - 12}" height="${oh - 12}" fill="none" stroke="#ffffff" stroke-width="3"/>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="face" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c0}"/>
      <stop offset="0.48" stop-color="${c1}"/>
      <stop offset="1" stop-color="${c2}"/>
    </linearGradient>
    <clipPath id="ring">
      <path fill-rule="evenodd" d="M0 0 H${W} V${H} H0 Z M${mouldX} ${mouldY} H${W - mouldX} V${H - mouldY} H${mouldX} Z"/>
    </clipPath>
  </defs>
  ${mat}
  <path fill="url(#face)" fill-rule="evenodd" d="M0 0 H${W} V${H} H0 Z M${mouldX} ${mouldY} H${W - mouldX} V${H - mouldY} H${mouldX} Z"/>
  ${grain}
  <rect x="8" y="8" width="${W - 16}" height="${H - 16}" fill="none" stroke="${lip}" stroke-opacity="0.55" stroke-width="5"/>
  <rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" fill="none" stroke="${edge}" stroke-width="3"/>
  <rect x="${mouldX - 3}" y="${mouldY - 3}" width="${W - mouldX * 2 + 6}" height="${H - mouldY * 2 + 6}" fill="none" stroke="#000" stroke-opacity="0.28" stroke-width="4"/>
  <rect x="${ox}" y="${oy}" width="${ow}" height="${oh}" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="8"/>
  ${hanger}
</svg>`;
}

function sceneSvg(w, h) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffd7a8"/>
      <stop offset="0.45" stop-color="#f08b78"/>
      <stop offset="1" stop-color="#c44958"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#sky)"/>
  <circle cx="${w * 0.72}" cy="${h * 0.28}" r="${w * 0.12}" fill="#ffe7b0"/>
  <path d="M0 ${h * 0.62} C ${w * 0.2} ${h * 0.5}, ${w * 0.35} ${h * 0.7}, ${w * 0.55} ${h * 0.58} C ${w * 0.75} ${h * 0.46}, ${w * 0.85} ${h * 0.66}, ${w} ${h * 0.55} V${h} H0 Z" fill="#35506d"/>
  <path d="M0 ${h * 0.72} C ${w * 0.3} ${h * 0.66}, ${w * 0.5} ${h * 0.8}, ${w} ${h * 0.7} V${h} H0 Z" fill="#24364c"/>
  <path d="M0 ${h * 0.48} L ${w * 0.22} ${h * 0.34} L ${w * 0.38} ${h * 0.5} Z" fill="#6d4a55"/>
  <path d="M${w * 0.28} ${h * 0.52} L ${w * 0.52} ${h * 0.3} L ${w * 0.7} ${h * 0.52} Z" fill="#8a5b58"/>
  <path d="M${w * 0.58} ${h * 0.5} L ${w * 0.86} ${h * 0.32} L ${w} ${h * 0.52} Z" fill="#5c3d49"/>
  <circle cx="${w * 0.18}" cy="${h * 0.22}" r="${w * 0.01}" fill="#fff6e8"/>
  <circle cx="${w * 0.3}" cy="${h * 0.16}" r="${w * 0.008}" fill="#fff6e8"/>
  <path d="M${w * 0.12} ${h * 0.24} q ${w * 0.04} ${-h * 0.02} ${w * 0.07} 0" fill="none" stroke="#fff6e8" stroke-width="${Math.max(2, w * 0.004)}"/>
</svg>`;
}

for (const frame of frames) {
  const svg = frame.category === "navidad" ? christmasSvg(frame) : frameSvg(frame);
  const file = path.join(outDir, `${frame.id}.png`);
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(file);
  const meta = await sharp(file).metadata();
  const raw = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = raw.info;
  const center = (Math.floor(height / 2) * width + Math.floor(width / 2)) * channels + 3;
  const corner = 3;
  if (raw.data[center] !== 0) {
    throw new Error(`${frame.id} center is not transparent (alpha ${raw.data[center]})`);
  }
  if (raw.data[corner] === 0) {
    throw new Error(`${frame.id} corner is transparent`);
  }
  console.log(`${frame.id} ${meta.width}x${meta.height} hole-ok`);
}

const sampleW = 1772;
const sampleH = 2362;
await sharp(Buffer.from(sceneSvg(sampleW, sampleH))).png({ compressionLevel: 9 }).toFile(path.join(root, "assets/sample-memory.png"));
await sharp(Buffer.from(sceneSvg(700, 900))).png({ compressionLevel: 9 }).toFile(path.join(root, "assets/sample-small.png"));
await writeFile(
  path.join(root, "data/samples.json"),
  JSON.stringify({ sample: { width: sampleW, height: sampleH }, "sample-small": { width: 700, height: 900 } }, null, 2) + "\n",
);
console.log("samples ready");
