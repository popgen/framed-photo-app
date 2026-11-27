/**
 * Printed Christmas borders ("Marco navideño impreso").
 *
 * These are not physical frames. Each one is a vector design drawn over the
 * customer's photo, both in the editor preview and in the print file the admin
 * downloads, so nothing extra is bought or shipped. Every design is original
 * geometry made here in code (no outside artwork) and scales to any print size.
 */

export type PrintBorderId = "acebo" | "guirnalda" | "copos" | "baston" | "estrella" | "andino";

export type PrintBorder = { id: PrintBorderId; name: string; blurb: string };

export const PRINT_BORDERS: PrintBorder[] = [
  { id: "acebo", name: "Acebo", blurb: "Ramitas de acebo con bayas rojas en las cuatro esquinas y una línea dorada fina." },
  { id: "guirnalda", name: "Guirnalda", blurb: "Guirnalda de pino alrededor de toda la foto, con esferas rojas y doradas." },
  { id: "copos", name: "Copos", blurb: "Copos de nieve dispersos sobre un borde escarchado blanco." },
  { id: "baston", name: "Bastón", blurb: "Franja de rayas rojas y blancas, como un bastón de caramelo." },
  { id: "estrella", name: "Estrella dorada", blurb: "Doble línea dorada, minimalista, con una estrella arriba al centro." },
  { id: "andino", name: "Andino", blurb: "Franja tejida de rombos escalonados, con estrellas de ocho puntas en las esquinas." },
];

/** Price of a printed border. Lucas asked that nothing extra be bought, so it is free. */
export const PRINT_BORDER_CENTS = 0;

export const PRINT_BORDER_NOTE = "Se imprime sobre tu foto. No es un marco físico y no cuesta más.";

export function findPrintBorder(id: string | null | undefined): PrintBorder | undefined {
  if (!id) return undefined;
  return PRINT_BORDERS.find((item) => item.id === id);
}

/** Returns a known border id or null, so stale or tampered values never reach an order. */
export function normalizePrintBorder(id: unknown): PrintBorderId | null {
  return typeof id === "string" && findPrintBorder(id) ? (id as PrintBorderId) : null;
}

export function printBorderLabel(id: string | null | undefined): string | null {
  const border = findPrintBorder(id);
  return border ? `Marco navideño impreso: ${border.name}` : null;
}

// ---------------------------------------------------------------------------
// Drawing. Coordinates use a box whose short side is 1000 units; the SVG's
// width/height attributes set the real pixel size, so the same art is crisp in
// a 60 px thumbnail and in a 300 dpi print.

const RED = "#B8262E";
const RED_DARK = "#7E1820";
const GREEN = "#1F5A3A";
const GREEN_DARK = "#123B26";
const GREEN_LIGHT = "#3E7F4E";
const GOLD = "#D3A84B";
const GOLD_DARK = "#9A7224";
const CREAM = "#FBF4E6";

const r = (n: number) => Math.round(n * 10) / 10;

function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function box(width: number, height: number) {
  const w0 = Math.max(1, width);
  const h0 = Math.max(1, height);
  const k = 1000 / Math.min(w0, h0);
  return { W: r(w0 * k), H: r(h0 * k) };
}

function frameBand(W: number, H: number, inset: number) {
  return `M0 0H${W}V${H}H0Z M${inset} ${inset}V${H - inset}H${W - inset}V${inset}Z`;
}

/** Four copies of a top-left corner group, mirrored into each corner. */
function corners(W: number, H: number, group: string) {
  return [
    `<g>${group}</g>`,
    `<g transform="translate(${W} 0) scale(-1 1)">${group}</g>`,
    `<g transform="translate(0 ${H}) scale(1 -1)">${group}</g>`,
    `<g transform="translate(${W} ${H}) scale(-1 -1)">${group}</g>`,
  ].join("");
}

function star(cx: number, cy: number, outer: number, inner: number, points = 5, rotate = -90) {
  const parts: string[] = [];
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = ((rotate + (i * 180) / points) * Math.PI) / 180;
    parts.push(`${r(cx + radius * Math.cos(angle))} ${r(cy + radius * Math.sin(angle))}`);
  }
  return `M${parts.join("L")}Z`;
}

const LEAF = "M0 0Q8 -16 18 -10Q24 -24 36 -14Q44 -27 55 -14Q64 -24 72 -9Q82 -14 90 0Q82 14 72 9Q64 24 55 14Q44 27 36 14Q24 24 18 10Q8 16 0 0Z";

function leaf(x: number, y: number, angle: number, scale: number) {
  return `<g transform="translate(${r(x)} ${r(y)}) rotate(${r(angle)}) scale(${r(scale * 100) / 100})"><path d="${LEAF}" fill="${GREEN}" stroke="${GREEN_DARK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M4 0L86 0" stroke="${GREEN_LIGHT}" stroke-width="2.2" stroke-linecap="round"/></g>`;
}

function berry(x: number, y: number, radius: number) {
  return `<circle cx="${r(x)}" cy="${r(y)}" r="${r(radius)}" fill="${RED}" stroke="${RED_DARK}" stroke-width="1.6"/><circle cx="${r(x - radius * 0.35)}" cy="${r(y - radius * 0.35)}" r="${r(radius * 0.3)}" fill="#ffffff" fill-opacity="0.75"/>`;
}

function acebo(W: number, H: number) {
  const line = `<rect x="34" y="34" width="${W - 68}" height="${H - 68}" fill="none" stroke="${GOLD}" stroke-width="4"/><rect x="34" y="34" width="${W - 68}" height="${H - 68}" fill="none" stroke="${GOLD_DARK}" stroke-opacity="0.5" stroke-width="1"/>`;
  const corner = [
    leaf(30, 34, 8, 1.55),
    leaf(34, 30, 82, 1.55),
    leaf(42, 42, 45, 1.25),
    leaf(150, 36, -12, 0.9),
    leaf(36, 150, 102, 0.9),
    berry(46, 46, 15),
    berry(70, 40, 12),
    berry(40, 70, 12),
    berry(66, 66, 10),
  ].join("");
  return line + corners(W, H, `<g transform="translate(16 16)">${corner}</g>`);
}

function guirnalda(W: number, H: number) {
  const rand = rng(1225);
  const inset = 46;
  const dark: string[] = [];
  const mid: string[] = [];
  const light: string[] = [];
  const points: [number, number][] = [];
  const step = 9;
  for (let x = inset; x <= W - inset; x += step) points.push([x, inset], [x, H - inset]);
  for (let y = inset + step; y < H - inset; y += step) points.push([inset, y], [W - inset, y]);
  for (const [px, py] of points) {
    for (let n = 0; n < 5; n += 1) {
      const angle = rand() * Math.PI * 2;
      const length = 18 + rand() * 22;
      const x2 = px + Math.cos(angle) * length;
      const y2 = py + Math.sin(angle) * length;
      const target = n < 2 ? dark : n < 4 ? mid : light;
      target.push(`M${r(px)} ${r(py)}L${r(x2)} ${r(y2)}`);
    }
  }
  const needles = [
    `<path d="${dark.join("")}" stroke="${GREEN_DARK}" stroke-width="5" stroke-linecap="round" fill="none"/>`,
    `<path d="${mid.join("")}" stroke="${GREEN}" stroke-width="4" stroke-linecap="round" fill="none"/>`,
    `<path d="${light.join("")}" stroke="${GREEN_LIGHT}" stroke-width="3" stroke-linecap="round" fill="none"/>`,
  ].join("");
  const baubles: string[] = [];
  const spots: [number, number][] = [];
  const gap = 170;
  for (let x = inset + gap / 2; x < W - inset; x += gap) spots.push([x, inset + 8], [x, H - inset + 8]);
  for (let y = inset + gap / 2; y < H - inset; y += gap) spots.push([inset + 6, y], [W - inset - 6, y]);
  spots.forEach(([x, y], index) => {
    const fill = index % 3 === 1 ? GOLD : RED;
    const edge = index % 3 === 1 ? GOLD_DARK : RED_DARK;
    baubles.push(`<circle cx="${r(x)}" cy="${r(y)}" r="13" fill="${fill}" stroke="${edge}" stroke-width="2"/><circle cx="${r(x - 4)}" cy="${r(y - 4)}" r="3.6" fill="#ffffff" fill-opacity="0.8"/>`);
  });
  return needles + baubles.join("");
}

function snowflake(x: number, y: number, size: number, rotate: number) {
  const arm = `M0 0L0 ${-size}M0 ${r(-size * 0.55)}L${r(size * 0.24)} ${r(-size * 0.78)}M0 ${r(-size * 0.55)}L${r(-size * 0.24)} ${r(-size * 0.78)}M0 ${r(-size * 0.28)}L${r(size * 0.16)} ${r(-size * 0.42)}M0 ${r(-size * 0.28)}L${r(-size * 0.16)} ${r(-size * 0.42)}`;
  const arms = [0, 60, 120, 180, 240, 300].map((angle) => `<path transform="rotate(${angle})" d="${arm}"/>`).join("");
  const width = Math.max(2.2, size * 0.09);
  return `<g transform="translate(${r(x)} ${r(y)}) rotate(${r(rotate)})" fill="none" stroke-linecap="round"><g stroke="#24435E" stroke-opacity="0.28" stroke-width="${r(width + 3)}">${arms}</g><g stroke="#ffffff" stroke-width="${r(width)}">${arms}</g></g>`;
}

function copos(W: number, H: number) {
  const rand = rng(2412);
  const depth = 120;
  const frost = [
    `<defs>`,
    `<linearGradient id="ft" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff" stop-opacity="0.78"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>`,
    `<linearGradient id="fb" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0.78"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>`,
    `<linearGradient id="fl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0.78"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>`,
    `<linearGradient id="fr" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="#ffffff" stop-opacity="0.78"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></linearGradient>`,
    `</defs>`,
    `<rect x="0" y="0" width="${W}" height="${depth}" fill="url(#ft)"/>`,
    `<rect x="0" y="${H - depth}" width="${W}" height="${depth}" fill="url(#fb)"/>`,
    `<rect x="0" y="0" width="${depth}" height="${H}" fill="url(#fl)"/>`,
    `<rect x="${W - depth}" y="0" width="${depth}" height="${H}" fill="url(#fr)"/>`,
  ].join("");
  const flakes: string[] = [];
  const dots: string[] = [];
  const perimeter = 2 * (W + H);
  const count = Math.round(perimeter / 95);
  for (let i = 0; i < count; i += 1) {
    const along = ((i + rand() * 0.6) / count) * perimeter;
    const inward = 18 + rand() * 95;
    let x: number;
    let y: number;
    if (along < W) [x, y] = [along, inward];
    else if (along < W + H) [x, y] = [W - inward, along - W];
    else if (along < 2 * W + H) [x, y] = [2 * W + H - along, H - inward];
    else [x, y] = [inward, perimeter - along];
    const size = inward < 60 ? 16 + rand() * 20 : 9 + rand() * 12;
    flakes.push(snowflake(x, y, size, rand() * 60));
    const dx = x + (rand() - 0.5) * 70;
    const dy = y + (rand() - 0.5) * 70;
    dots.push(`<circle cx="${r(dx)}" cy="${r(dy)}" r="${r(2.5 + rand() * 3)}" fill="#ffffff" stroke="#24435E" stroke-opacity="0.2" stroke-width="1.2"/>`);
  }
  return frost + dots.join("") + flakes.join("");
}

function baston(W: number, H: number) {
  const band = 52;
  return [
    `<defs><pattern id="cane" patternUnits="userSpaceOnUse" width="34" height="34" patternTransform="rotate(45)"><rect width="34" height="34" fill="#ffffff"/><rect width="17" height="34" fill="${RED}"/></pattern></defs>`,
    `<path d="${frameBand(W, H, band)}" fill="url(#cane)" fill-rule="evenodd"/>`,
    `<rect x="${band}" y="${band}" width="${W - band * 2}" height="${H - band * 2}" fill="none" stroke="#ffffff" stroke-width="7"/>`,
    `<rect x="${band + 4}" y="${band + 4}" width="${W - band * 2 - 8}" height="${H - band * 2 - 8}" fill="none" stroke="${RED_DARK}" stroke-opacity="0.55" stroke-width="2"/>`,
    `<rect x="1.5" y="1.5" width="${W - 3}" height="${H - 3}" fill="none" stroke="${RED_DARK}" stroke-width="3"/>`,
  ].join("");
}

function estrella(W: number, H: number) {
  const outer = 36;
  const inner = 50;
  const cx = W / 2;
  const gap = 54;
  const shadow = `stroke="#000000" stroke-opacity="0.22"`;
  const lines = (stroke: string, a: number, b: number) =>
    `<path d="M${cx - gap} ${outer}H${outer}V${H - outer}H${W - outer}V${outer}H${cx + gap}" fill="none" ${stroke} stroke-width="${a}" stroke-linejoin="miter"/>` +
    `<rect x="${inner}" y="${inner}" width="${W - inner * 2}" height="${H - inner * 2}" fill="none" ${stroke} stroke-width="${b}"/>`;
  const big = star(cx, outer + 2, 40, 16);
  const small = star(cx, H - outer, 13, 5.5);
  return [
    lines(shadow, 9, 5),
    lines(`stroke="${GOLD}"`, 6, 2.6),
    `<path d="${big}" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="2" stroke-linejoin="round"/>`,
    `<path d="${small}" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="1.5" stroke-linejoin="round"/>`,
  ].join("");
}

/** A 7x7 stepped diamond, drawn from small squares like a woven textile. */
const ROMBO = ["...X...", "..XXX..", ".XX.XX.", "XX.X.XX", ".XX.XX.", "..XXX..", "...X..."];

function rombo(x: number, y: number, cell: number, fill: string) {
  const squares: string[] = [];
  ROMBO.forEach((row, ry) => {
    [...row].forEach((mark, rx) => {
      if (mark === "X") squares.push(`M${r(x + rx * cell)} ${r(y + ry * cell)}h${cell}v${cell}h-${cell}Z`);
    });
  });
  return `<path d="${squares.join("")}" fill="${fill}"/>`;
}

function andino(W: number, H: number) {
  const band = 76;
  const cell = 6;
  const motif = cell * 7;
  const mid = 38;
  const colors = [RED, GREEN, GOLD_DARK];
  const parts: string[] = [
    `<path d="${frameBand(W, H, band)}" fill="${CREAM}" fill-rule="evenodd"/>`,
    `<path d="${frameBand(W, H, 10)}" fill="${RED}" fill-rule="evenodd"/>`,
    `<path d="M10 10H${W - 10}V${H - 10}H10Z M16 16V${H - 16}H${W - 16}V16Z" fill="${GOLD}" fill-rule="evenodd"/>`,
    `<path d="M${band - 8} ${band - 8}H${W - band + 8}V${H - band + 8}H${band - 8}Z M${band} ${band}V${H - band}H${W - band}V${band}Z" fill="${GREEN}" fill-rule="evenodd"/>`,
  ];
  const run = (length: number) => {
    const usable = length - band * 2 - 20;
    const count = Math.max(1, Math.floor(usable / (motif + 18)));
    const pitch = usable / count;
    return Array.from({ length: count }, (_, i) => band + 10 + pitch * i + (pitch - motif) / 2);
  };
  run(W).forEach((x, i) => {
    parts.push(rombo(x, mid - motif / 2, cell, colors[i % 3]));
    parts.push(rombo(x, H - mid - motif / 2, cell, colors[(i + 1) % 3]));
  });
  run(H).forEach((y, i) => {
    parts.push(rombo(mid - motif / 2, y, cell, colors[(i + 2) % 3]));
    parts.push(rombo(W - mid - motif / 2, y, cell, colors[i % 3]));
  });
  const corner = `<rect x="16" y="16" width="${band - 24}" height="${band - 24}" fill="${RED}"/><path d="${star(16 + (band - 24) / 2, 16 + (band - 24) / 2, 22, 10, 8, -90)}" fill="${GOLD}" stroke="${CREAM}" stroke-width="1.5"/>`;
  parts.push(corners(W, H, corner));
  return parts.join("");
}

const DRAW: Record<PrintBorderId, (W: number, H: number) => string> = { acebo, guirnalda, copos, baston, estrella, andino };

/** Full SVG markup for a border at the given pixel size (transparent outside the art). */
export function printBorderSvg(id: string, width: number, height: number): string | null {
  const border = findPrintBorder(id);
  if (!border) return null;
  const { W, H } = box(width, height);
  const body = DRAW[border.id](W, H);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(width)}" height="${Math.round(height)}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${body}</svg>`;
}

export function printBorderDataUri(id: string, width: number, height: number): string | null {
  const svg = printBorderSvg(id, width, height);
  return svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}` : null;
}
