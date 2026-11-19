import type { Orientation, ResolutionStatus, Crop } from "./print-size";
import { centeredCrop, printDpi, refitCrop, resolutionStatus, targetPixels } from "./print-size";

/** Extra por armar el collage, en céntimos. En 0 se cobra solo el marco. */
export const COLLAGE_SURCHARGE_CENTS = 0;
export const COLLAGE_MIN_PHOTOS = 2;
export const COLLAGE_MAX_PHOTOS = 12;
export const CAPTION_BAND = 0.09;
export const NAVIDAD_MARGIN = 0.068;
export const NAVIDAD_CAPTION_BAND = 0.12;
export const MAX_CANVAS_EDGE = 8192;
export const MAX_CANVAS_PIXELS = 16_777_216;

export type CollageSpacing = "none" | "thin" | "thick";
export type CollageBackground = "white" | "cream" | "red" | "black" | "desk";
export type TemplateId = "lado" | "hero" | "grid2" | "grid23" | "grid33" | "mosaic" | "navidad" | "polaroids";
export type NormRect = { x: number; y: number; w: number; h: number; rotation?: number };

export type CollageSource = {
  photoId: string;
  storagePath?: string | null;
  width: number;
  height: number;
  crop: Crop;
  cell: NormRect;
  /** Degrees around the Polaroid center. Only Polaroids uses it. */
  rotation?: number;
  dpi: number;
  resolutionStatus: ResolutionStatus;
};

export type CollageSnapshot = {
  version: 1;
  templateId: TemplateId;
  templateName: string;
  spacing: CollageSpacing;
  background: CollageBackground;
  rounded: boolean;
  caption: string;
  frameId: string;
  orientation: Orientation;
  printWcm: number;
  printHcm: number;
  sources: CollageSource[];
  surchargeCents: number;
  /** Seed of a Polaroid scatter. The same seed redraws the same print. */
  layoutSeed?: number;
};

export const SPACING_OPTIONS: { id: CollageSpacing; label: string; amount: number }[] = [
  { id: "none", label: "Sin borde", amount: 0 },
  { id: "thin", label: "Fino", amount: 0.012 },
  { id: "thick", label: "Grueso", amount: 0.032 },
];

export const BACKGROUND_OPTIONS: { id: CollageBackground; label: string; hex: string }[] = [
  { id: "white", label: "Blanco", hex: "#FFFFFF" },
  { id: "cream", label: "Crema", hex: "#F6EFE6" },
  { id: "red", label: "Rojo Navidad", hex: "#C5363C" },
  { id: "black", label: "Negro", hex: "#241714" },
  { id: "desk", label: "Mesa", hex: "#E4D2C0" },
];

export const TEMPLATES: { id: TemplateId; name: string; min: number; max: number }[] = [
  { id: "lado", name: "Lado a lado", min: 2, max: 2 },
  { id: "hero", name: "Una grande y dos", min: 3, max: 3 },
  { id: "grid2", name: "Cuadrícula de 4", min: 4, max: 4 },
  { id: "grid23", name: "Cuadrícula de 6", min: 6, max: 6 },
  { id: "grid33", name: "Cuadrícula de 9", min: 9, max: 9 },
  { id: "mosaic", name: "Mosaico", min: 2, max: 12 },
  { id: "navidad", name: "Navidad", min: 2, max: 12 },
  { id: "polaroids", name: "Polaroids sobre la mesa", min: 1, max: 12 },
];

const MOSAIC_ROWS: Record<number, number[][]> = {
  2: [[1.6, 1]],
  3: [[1.7, 1], [1]],
  4: [[1.8, 1], [1, 1]],
  5: [[1.5, 1], [1, 1, 1]],
  6: [[1.6, 1], [1, 1.3, 0.7], [1.2]],
  7: [[1.6, 1], [1, 1, 1], [1.2, 0.8]],
  8: [[1, 1.4, 0.8], [1.5, 1], [1, 1, 1]],
  9: [[1.5, 1, 0.8], [1, 1.3, 1], [0.8, 1, 1.2]],
  10: [[1.4, 1], [1, 1, 1], [1.2, 0.8, 1], [1, 1]],
  11: [[1, 1.5, 1], [1, 1, 1], [1, 1], [1, 1, 1]],
  12: [[1.3, 1, 0.8], [1, 1, 1.4], [1, 1, 1], [0.8, 1, 1.2]],
};

export function templateById(id: TemplateId) {
  const found = TEMPLATES.find((item) => item.id === id);
  if (!found) throw new Error(`Plantilla desconocida: ${id}`);
  return found;
}

export function templateFits(id: TemplateId, count: number): boolean {
  const template = templateById(id);
  return count >= template.min && count <= template.max;
}

export function suggestTemplate(count: number): TemplateId {
  if (count <= 2) return "lado";
  if (count === 3) return "hero";
  if (count === 4) return "grid2";
  if (count === 5) return "mosaic";
  if (count === 6) return "grid23";
  if (count <= 8) return "mosaic";
  if (count === 9) return "grid33";
  return "mosaic";
}

export function previewCount(id: TemplateId): number {
  const template = templateById(id);
  if (template.min === template.max) return template.min;
  if (id === "navidad") return 4;
  if (id === "polaroids") return 5;
  return 5;
}

export function resolveLayout(preferred: TemplateId, count: number): { id: TemplateId; notice: string | null } {
  if (count < COLLAGE_MIN_PHOTOS || templateFits(preferred, count)) return { id: preferred, notice: null };
  const id = suggestTemplate(count);
  const wanted = templateById(preferred).name;
  const used = templateById(id).name;
  return {
    id,
    notice: `Con ${count} fotos, ${wanted} no entra. Las acomodamos en ${used}.`,
  };
}

export type PhotoShape = "tall" | "wide" | "square";

export function photoShape(width: number, height: number): PhotoShape {
  if (height > width * 1.08) return "tall";
  if (width > height * 1.08) return "wide";
  return "square";
}

export function arrangeIndexes(
  photos: { width: number; height: number }[],
  cells: { wCm: number; hCm: number }[],
): number[] {
  const used = new Set<number>();
  const picks: number[] = [];
  for (const cell of cells) {
    const want = photoShape(cell.wCm, cell.hCm);
    let pick = photos.findIndex((photo, index) => !used.has(index) && photoShape(photo.width, photo.height) === want);
    if (pick < 0) pick = photos.findIndex((_, index) => !used.has(index));
    if (pick < 0) break;
    used.add(pick);
    picks.push(pick);
  }
  return picks;
}

export function backgroundHex(id: CollageBackground): string {
  return BACKGROUND_OPTIONS.find((item) => item.id === id)?.hex ?? "#FFFFFF";
}

export function spacingLabel(id: CollageSpacing): string {
  return SPACING_OPTIONS.find((item) => item.id === id)?.label ?? "Sin borde";
}

export function backgroundLabel(id: CollageBackground): string {
  return BACKGROUND_OPTIONS.find((item) => item.id === id)?.label ?? "Blanco";
}

export function captionColor(id: CollageBackground): string {
  return id === "black" || id === "red" ? "#F6EFE6" : "#241714";
}

export function framedPriceCents(framePriceCents: number, hasCollage: boolean): number {
  return framePriceCents + (hasCollage ? COLLAGE_SURCHARGE_CENTS : 0);
}

export function layoutCells(input: {
  templateId: TemplateId;
  count: number;
  spacing: CollageSpacing;
  caption: string;
  aspectW: number;
  aspectH: number;
  seed?: number;
}): NormRect[] {
  if (!templateFits(input.templateId, input.count)) {
    throw new Error(`La plantilla no acepta ${input.count} fotos.`);
  }
  if (input.templateId === "polaroids") return polaroidCells(input);
  const wide = input.aspectW > input.aspectH + 0.01;
  const caption = input.caption.trim().length > 0;
  let cells: NormRect[];
  if (input.templateId === "navidad") {
    cells = insetCells(rawCells(suggestTemplate(input.count), input.count, wide), NAVIDAD_MARGIN, caption ? NAVIDAD_CAPTION_BAND : NAVIDAD_MARGIN);
  } else {
    cells = rawCells(input.templateId, input.count, wide);
    if (caption) cells = reserveCaption(cells, CAPTION_BAND);
  }
  const amount = SPACING_OPTIONS.find((item) => item.id === input.spacing)?.amount ?? 0;
  return applyGap(cells, amount, input.aspectW, input.aspectH);
}

export function printAspect(printWcm: number, printHcm: number, orientation: Orientation) {
  const target = targetPixels(printWcm, printHcm, orientation);
  return { w: target.wCm, h: target.hCm, width: target.width, height: target.height };
}

export function compositePixels(printWcm: number, printHcm: number, orientation: Orientation) {
  const aspect = printAspect(printWcm, printHcm, orientation);
  return { width: aspect.width, height: aspect.height, wCm: aspect.w, hCm: aspect.h };
}

export function fitCompositeSize(
  width: number,
  height: number,
  limits: { maxEdge?: number; maxPixels?: number } = {},
) {
  const maxEdge = limits.maxEdge ?? MAX_CANVAS_EDGE;
  const maxPixels = limits.maxPixels ?? MAX_CANVAS_PIXELS;
  let scale = 1;
  scale = Math.min(scale, maxEdge / Math.max(width, height));
  const area = width * height;
  if (area > maxPixels) scale = Math.min(scale, Math.sqrt(maxPixels / area));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

export function cellCentimeters(cell: NormRect, printWcm: number, printHcm: number, orientation: Orientation) {
  const aspect = printAspect(printWcm, printHcm, orientation);
  return { wCm: cell.w * aspect.w, hCm: cell.h * aspect.h };
}

export function cellPixels(cell: NormRect, canvasW: number, canvasH: number) {
  const x = Math.round(cell.x * canvasW);
  const y = Math.round(cell.y * canvasH);
  const right = Math.round((cell.x + cell.w) * canvasW);
  const bottom = Math.round((cell.y + cell.h) * canvasH);
  return { x, y, w: Math.max(1, right - x), h: Math.max(1, bottom - y) };
}

export function cropsForCells(
  photos: { width: number; height: number; crop?: Crop | null }[],
  cells: NormRect[],
  printWcm: number,
  printHcm: number,
  orientation: Orientation,
): Crop[] {
  return photos.map((photo, index) => {
    const cm = cellCentimeters(cells[index], printWcm, printHcm, orientation);
    const aspectW = Math.max(cm.wCm, 0.01);
    const aspectH = Math.max(cm.hCm, 0.01);
    if (!photo.crop || photo.crop.imageWidth !== photo.width || photo.crop.imageHeight !== photo.height) {
      return centeredCrop(photo.width, photo.height, aspectW, aspectH);
    }
    const ratio = photo.crop.width / photo.crop.height;
    if (Math.abs(ratio - aspectW / aspectH) < 0.02) return photo.crop;
    return refitCrop(photo.crop, aspectW, aspectH);
  });
}

export function assessCells(
  crops: Crop[],
  cells: NormRect[],
  printWcm: number,
  printHcm: number,
  orientation: Orientation,
) {
  if (!crops.length) return { reports: [], dpi: 0, status: "good" as const, message: null };
  const reports = crops.map((crop, index) => {
    const cm = cellCentimeters(cells[index], printWcm, printHcm, orientation);
    const dpi = printDpi(crop.width, crop.height, cm.wCm, cm.hCm);
    return { index, dpi, status: resolutionStatus(dpi), wCm: cm.wCm, hCm: cm.hCm };
  });
  const worst = reports.reduce((best, item) => (item.dpi < best.dpi ? item : best));
  const shown = Math.round(worst.dpi);
  const n = worst.index + 1;
  let message: string | null = null;
  if (worst.status === "soft") {
    message = `La foto ${n} está en ${shown} dpi dentro de su espacio. Se imprime bien, aunque de cerca se verá un poco más suave.`;
  } else if (worst.status === "low") {
    message = `La foto ${n} queda en ${shown} dpi para su espacio. Elige una imagen más grande o un marco más chico.`;
  }
  return { reports, dpi: worst.dpi, status: worst.status, message };
}

export function buildSnapshot(input: {
  templateId: TemplateId;
  spacing: CollageSpacing;
  background: CollageBackground;
  rounded: boolean;
  caption: string;
  frameId: string;
  orientation: Orientation;
  printWcm: number;
  printHcm: number;
  photos: { photoId: string; width: number; height: number; crop: Crop }[];
  layoutSeed?: number;
}): CollageSnapshot {
  const aspect = printAspect(input.printWcm, input.printHcm, input.orientation);
  const cells = layoutCells({
    templateId: input.templateId,
    count: input.photos.length,
    spacing: input.spacing,
    caption: input.caption,
    aspectW: aspect.w,
    aspectH: aspect.h,
    seed: input.layoutSeed,
  });
  const assessed = assessCells(
    input.photos.map((photo) => photo.crop),
    cells,
    input.printWcm,
    input.printHcm,
    input.orientation,
  );
  return {
    version: 1,
    templateId: input.templateId,
    templateName: templateById(input.templateId).name,
    spacing: input.spacing,
    background: input.background,
    rounded: input.rounded,
    caption: input.caption.trim(),
    frameId: input.frameId,
    orientation: input.orientation,
    printWcm: input.printWcm,
    printHcm: input.printHcm,
    surchargeCents: COLLAGE_SURCHARGE_CENTS,
    ...(input.templateId === "polaroids" ? { layoutSeed: input.layoutSeed ?? POLAROID_PREVIEW_SEED } : {}),
    sources: input.photos.map((photo, index) => ({
      photoId: photo.photoId,
      width: photo.width,
      height: photo.height,
      crop: photo.crop,
      cell: cells[index],
      ...(cells[index].rotation != null ? { rotation: cells[index].rotation } : {}),
      dpi: Math.round(assessed.reports[index].dpi),
      resolutionStatus: assessed.reports[index].status,
    })),
  };
}

export function fullFrameCrop(width: number, height: number): Crop {
  return { imageWidth: width, imageHeight: height, x: 0, y: 0, width, height };
}

export function zoomCrop(crop: Crop, factor: number): Crop {
  const cx = crop.x + crop.width / 2;
  const cy = crop.y + crop.height / 2;
  let width = crop.width / factor;
  let height = crop.height / factor;
  const minW = Math.min(crop.imageWidth, Math.max(crop.imageWidth * 0.18, 1));
  const minH = Math.min(crop.imageHeight, Math.max(crop.imageHeight * 0.18, 1));
  if (width < minW || height < minH) {
    const scale = Math.max(minW / width, minH / height);
    width *= scale;
    height *= scale;
  }
  if (width > crop.imageWidth || height > crop.imageHeight) {
    const scale = Math.min(crop.imageWidth / width, crop.imageHeight / height);
    width *= scale;
    height *= scale;
  }
  return {
    ...crop,
    width,
    height,
    x: clamp(cx - width / 2, 0, Math.max(0, crop.imageWidth - width)),
    y: clamp(cy - height / 2, 0, Math.max(0, crop.imageHeight - height)),
  };
}

export function panCrop(crop: Crop, dxPx: number, dyPx: number, cellW: number, cellH: number): Crop {
  const x = crop.x - (dxPx / Math.max(cellW, 1)) * crop.width;
  const y = crop.y - (dyPx / Math.max(cellH, 1)) * crop.height;
  return {
    ...crop,
    x: clamp(x, 0, Math.max(0, crop.imageWidth - crop.width)),
    y: clamp(y, 0, Math.max(0, crop.imageHeight - crop.height)),
  };
}

export function swapped<T>(items: T[], left: number, right: number): T[] {
  const next = items.slice();
  const hold = next[left];
  next[left] = next[right];
  next[right] = hold;
  return next;
}

export function shuffled<T>(items: T[], random: () => number = Math.random): T[] {
  const next = items.slice();
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const hold = next[i];
    next[i] = next[j];
    next[j] = hold;
  }
  if (items.length > 1 && next.every((item, index) => item === items[index])) {
    const hold = next[0];
    next[0] = next[1];
    next[1] = hold;
  }
  return next;
}

export function mergePhotoCount(current: number, incoming: number, max = COLLAGE_MAX_PHOTOS) {
  const room = Math.max(0, max - current);
  const take = Math.min(room, Math.max(0, incoming));
  if (incoming > room) {
    return {
      take,
      note: room === 0 ? "Ya tienes 12 fotos. Quita alguna para agregar otra." : "Puedes juntar hasta 12 fotos. Dejamos las primeras que entran.",
    };
  }
  return { take, note: null as string | null };
}

function rawCells(id: TemplateId, count: number, wide: boolean): NormRect[] {
  let cells = portraitCells(id, count);
  if (wide && id !== "lado") cells = transpose(cells);
  return cells;
}

function portraitCells(id: TemplateId, count: number): NormRect[] {
  if (id === "lado") return grid(2, 1);
  if (id === "hero") {
    return [
      { x: 0, y: 0, w: 1, h: 0.64 },
      { x: 0, y: 0.64, w: 0.5, h: 0.36 },
      { x: 0.5, y: 0.64, w: 0.5, h: 0.36 },
    ];
  }
  if (id === "grid2") return grid(2, 2);
  if (id === "grid23") return grid(2, 3);
  if (id === "grid33") return grid(3, 3);
  return rows(MOSAIC_ROWS[count] ?? [[1]]);
}

function grid(cols: number, rowCount: number): NormRect[] {
  const cells: NormRect[] = [];
  for (let row = 0; row < rowCount; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      cells.push({ x: col / cols, y: row / rowCount, w: 1 / cols, h: 1 / rowCount });
    }
  }
  return cells;
}

function rows(spec: number[][]): NormRect[] {
  const rowH = 1 / spec.length;
  const cells: NormRect[] = [];
  spec.forEach((weights, row) => {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let x = 0;
    weights.forEach((weight) => {
      const w = weight / total;
      cells.push({ x, y: row * rowH, w, h: rowH });
      x += w;
    });
  });
  return cells;
}

function transpose(cells: NormRect[]): NormRect[] {
  return cells.map((cell) => ({ x: cell.y, y: cell.x, w: cell.h, h: cell.w }));
}

function reserveCaption(cells: NormRect[], band: number): NormRect[] {
  const scale = 1 - band;
  return cells.map((cell) => ({ ...cell, y: cell.y * scale, h: cell.h * scale }));
}

function insetCells(cells: NormRect[], margin: number, bottom: number): NormRect[] {
  const innerW = 1 - margin * 2;
  const innerH = 1 - margin - bottom;
  return cells.map((cell) => ({
    x: margin + cell.x * innerW,
    y: margin + cell.y * innerH,
    w: cell.w * innerW,
    h: cell.h * innerH,
  }));
}

function applyGap(cells: NormRect[], gap: number, aspectW: number, aspectH: number): NormRect[] {
  if (gap <= 0) return cells;
  const short = Math.min(aspectW, aspectH);
  const gx = (gap * short) / aspectW;
  const gy = (gap * short) / aspectH;
  return cells.map((cell) => {
    const insetX = Math.min(gx / 2, cell.w * 0.22);
    const insetY = Math.min(gy / 2, cell.h * 0.22);
    return {
      x: cell.x + insetX,
      y: cell.y + insetY,
      w: Math.max(0.02, cell.w - insetX * 2),
      h: Math.max(0.02, cell.h - insetY * 2),
    };
  });
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) return min;
  return Math.min(max, Math.max(min, value));
}

/** White margin around the photo, as a fraction of the photo width. The bottom is thicker. */
const POLAROID_SIDE = 0.065;
const POLAROID_TOP = 0.07;
const POLAROID_BOTTOM = 0.24;
const POLAROID_MAX_TURN = 8;
export const POLAROID_MIN_VISIBLE = 0.58;
/** Share of the print that may still show the desk. */
export const POLAROID_MAX_BACKGROUND = 0.15;
/** Stable scatter for the empty preview and the layout card. */
export const POLAROID_PREVIEW_SEED = 0x504f4c41;

export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function freshLayoutSeed(): number {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    const buf = new Uint32Array(1);
    cryptoObj.getRandomValues(buf);
    if (buf[0]) return buf[0];
  }
  return (Math.floor(Math.random() * 0x100000000) >>> 0) || 1;
}

/** Separate stream so shuffling photos does not move the Polaroids. */
export function shuffleSeed(seed: number): number {
  return (Math.imul(seed >>> 0, 0x9e3779b1) ^ 0x6d2b79f5) >>> 0;
}

type CmCard = { cx: number; cy: number; photoCm: number; rotation: number };

function polaroidOuter(photoCm: number) {
  const side = POLAROID_SIDE * photoCm;
  const top = POLAROID_TOP * photoCm;
  const bottom = POLAROID_BOTTOM * photoCm;
  return { side, top, bottom, cardW: photoCm + side * 2, cardH: photoCm + top + bottom };
}

export function polaroidCard(photo: NormRect, aspectW: number, aspectH: number): NormRect {
  const photoW = photo.w * aspectW;
  const photoH = photo.h * aspectH;
  const side = POLAROID_SIDE * photoW;
  const top = POLAROID_TOP * photoW;
  const bottom = POLAROID_BOTTOM * photoW;
  return {
    x: photo.x - side / aspectW,
    y: photo.y - top / aspectH,
    w: (photoW + side * 2) / aspectW,
    h: (photoH + top + bottom) / aspectH,
    rotation: photo.rotation,
  };
}

function cardFromCell(cell: NormRect, aspectW: number, aspectH: number): CmCard {
  const photoCm = cell.w * aspectW;
  const outer = polaroidOuter(photoCm);
  const photoX = cell.x * aspectW;
  const photoY = cell.y * aspectH;
  return {
    cx: photoX - outer.side + outer.cardW / 2,
    cy: photoY - outer.top + outer.cardH / 2,
    photoCm,
    rotation: cell.rotation ?? 0,
  };
}

function cellFromCard(card: CmCard, aspectW: number, aspectH: number): NormRect {
  const outer = polaroidOuter(card.photoCm);
  const photoX = card.cx - outer.cardW / 2 + outer.side;
  const photoY = card.cy - outer.cardH / 2 + outer.top;
  return {
    x: photoX / aspectW,
    y: photoY / aspectH,
    w: card.photoCm / aspectW,
    h: card.photoCm / aspectH,
    rotation: card.rotation,
  };
}

function cardCorners(card: CmCard): { x: number; y: number }[] {
  const outer = polaroidOuter(card.photoCm);
  const rad = (card.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const hw = outer.cardW / 2;
  const hh = outer.cardH / 2;
  return [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([lx, ly]) => ({
    x: card.cx + lx * cos - ly * sin,
    y: card.cy + lx * sin + ly * cos,
  }));
}

function insideRotated(px: number, py: number, card: CmCard): boolean {
  const outer = polaroidOuter(card.photoCm);
  const rad = (-card.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = px - card.cx;
  const dy = py - card.cy;
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) <= outer.cardW / 2 && Math.abs(ly) <= outer.cardH / 2;
}

function photoSamples(card: CmCard): { x: number; y: number }[] {
  const outer = polaroidOuter(card.photoCm);
  const left = -outer.cardW / 2 + outer.side;
  const top = -outer.cardH / 2 + outer.top;
  const rad = (card.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const steps = 6;
  const points: { x: number; y: number }[] = [];
  for (let row = 0; row < steps; row += 1) {
    for (let col = 0; col < steps; col += 1) {
      const lx = left + ((col + 0.5) / steps) * card.photoCm;
      const ly = top + ((row + 0.5) / steps) * card.photoCm;
      points.push({
        x: card.cx + lx * cos - ly * sin,
        y: card.cy + lx * sin + ly * cos,
      });
    }
  }
  return points;
}

function coverFraction(cards: CmCard[], index: number, other: number): number {
  const samples = photoSamples(cards[index]);
  let covered = 0;
  for (const point of samples) {
    if (insideRotated(point.x, point.y, cards[other])) covered += 1;
  }
  return covered / samples.length;
}

function onPrint(x: number, y: number, aspectW: number, yMax: number): boolean {
  return x >= -1e-4 && y >= -1e-4 && x <= aspectW + 1e-4 && y <= yMax + 1e-4;
}

function visibleFraction(cards: CmCard[], index: number, aspectW: number, yMax: number): number {
  const samples = photoSamples(cards[index]);
  let free = 0;
  for (const point of samples) {
    if (!onPrint(point.x, point.y, aspectW, yMax)) continue;
    let covered = false;
    for (let other = index + 1; other < cards.length; other += 1) {
      if (insideRotated(point.x, point.y, cards[other])) {
        covered = true;
        break;
      }
    }
    if (!covered) free += 1;
  }
  return free / samples.length;
}

function deskFraction(cards: CmCard[], aspectW: number, yMax: number): number {
  const cols = 28;
  const rows = 36;
  let open = 0;
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = ((col + 0.5) / cols) * aspectW;
      const y = ((row + 0.5) / rows) * yMax;
      let hit = false;
      for (const card of cards) {
        if (insideRotated(x, y, card)) {
          hit = true;
          break;
        }
      }
      if (!hit) open += 1;
    }
  }
  return open / (cols * rows);
}

function clampBleed(card: CmCard, aspectW: number, yMax: number): CmCard {
  const outer = polaroidOuter(card.photoCm);
  const insetX = Math.min(aspectW * 0.2, outer.cardW * 0.32);
  const insetY = Math.min(yMax * 0.2, outer.cardH * 0.32);
  return {
    ...card,
    cx: clamp(card.cx, insetX, Math.max(insetX, aspectW - insetX)),
    cy: clamp(card.cy, insetY, Math.max(insetY, yMax - insetY)),
  };
}

function clearCaption(card: CmCard, yMax: number): CmCard {
  const lowest = Math.max(...cardCorners(card).map((point) => point.y));
  if (lowest <= yMax) return card;
  return { ...card, cy: card.cy - (lowest - yMax) };
}

function relaxCards(cards: CmCard[], aspectW: number, yMax: number): CmCard[] {
  const next = cards.map((card) => clearCaption(clampBleed(card, aspectW, yMax), yMax));
  for (let iter = 0; iter < 24; iter += 1) {
    let moved = false;
    for (let index = 0; index < next.length; index += 1) {
      if (visibleFraction(next, index, aspectW, yMax) >= POLAROID_MIN_VISIBLE) continue;
      for (let other = index + 1; other < next.length; other += 1) {
        const pair = coverFraction(next, index, other);
        if (pair < 0.12) continue;
        const step = Math.min(next[index].photoCm, next[other].photoCm) * 0.045;
        let vx = next[other].cx - next[index].cx;
        let vy = next[other].cy - next[index].cy;
        const dist = Math.hypot(vx, vy);
        if (dist < 0.05) {
          vx = index % 2 === 0 ? 1 : -1;
          vy = 0.35;
        } else {
          vx /= dist;
          vy /= dist;
        }
        next[other] = clearCaption(
          clampBleed({ ...next[other], cx: next[other].cx + vx * step, cy: next[other].cy + vy * step }, aspectW, yMax),
          yMax,
        );
        moved = true;
      }
    }
    if (!moved) break;
  }
  return next;
}

function rowCountsFor(count: number, cols: number): number[] {
  const rows = Math.ceil(count / cols);
  const counts: number[] = [];
  let remaining = count;
  for (let row = 0; row < rows; row += 1) {
    const take = Math.min(cols, remaining);
    counts.push(take);
    remaining -= take;
  }
  return counts;
}

function bestColumnCount(count: number, aspectW: number, yMax: number): number {
  const cardAspect = (1 + POLAROID_SIDE * 2) / (1 + POLAROID_TOP + POLAROID_BOTTOM);
  let cols = 1;
  let best = Infinity;
  for (let next = 1; next <= count; next += 1) {
    const rows = Math.ceil(count / next);
    const ratio = aspectW / next / (yMax / rows);
    const last = count - (rows - 1) * next;
    const uneven = last === next ? 0 : 0.35;
    const score = Math.abs(Math.log(ratio / cardAspect)) + uneven;
    if (score < best) {
      best = score;
      cols = next;
    }
  }
  return cols;
}

function polaroidCells(input: {
  count: number;
  spacing: CollageSpacing;
  caption: string;
  aspectW: number;
  aspectH: number;
  seed?: number;
}): NormRect[] {
  const rng = mulberry32(input.seed ?? POLAROID_PREVIEW_SEED);
  const gap = SPACING_OPTIONS.find((item) => item.id === input.spacing)?.amount ?? 0;
  const caption = input.caption.trim().length > 0;
  const yMax = caption ? input.aspectH * (1 - CAPTION_BAND) : input.aspectH;
  const cols = bestColumnCount(input.count, input.aspectW, yMax);
  const rowCounts = rowCountsFor(input.count, cols);
  const rows = rowCounts.length;
  const cellW = input.aspectW / cols;
  const cellH = yMax / rows;
  const cardAspect = (1 + POLAROID_SIDE * 2) / (1 + POLAROID_TOP + POLAROID_BOTTOM);
  const overlap = input.count <= 2 ? 1.05 : input.count === 3 ? 1.36 : input.count <= 8 ? 1.2 : 1.22;
  const photoCm = (input.count === 1
    ? Math.min(input.aspectW, yMax) * 1.05
    : overlap * Math.sqrt((cellW * cellH) / cardAspect) / (1 + POLAROID_TOP + POLAROID_BOTTOM)) * (1 - gap * 0.15);
  const anchors: { x: number; y: number }[] = [];
  rowCounts.forEach((countInRow, row) => {
    const span = input.aspectW / countInRow;
    for (let col = 0; col < countInRow; col += 1) {
      anchors.push({ x: (col + 0.5) * span, y: input.count === 1 ? yMax * 0.58 : (row + 0.5) * cellH });
    }
  });
  const seats = shuffled(anchors.map((_, index) => index), rng).map((index) => anchors[index]);
  const jitter = input.count === 1 ? 0.012 : 0.035 + rng() * 0.03;
  let cards = relaxCards(
    seats.map((seat, index) => ({
      cx: seat.x + (rng() * 2 - 1) * cellW * jitter,
      cy: seat.y + (rng() * 2 - 1) * cellH * jitter,
      photoCm,
      rotation: (rng() * 2 - 1) * POLAROID_MAX_TURN,
    })),
    input.aspectW,
    yMax,
  );
  if (input.count === 1 && cards[0]) {
    let card = { ...cards[0], cx: input.aspectW / 2, cy: yMax / 2 };
    for (let step = 0; step < 8; step += 1) {
      if (deskFraction([card], input.aspectW, yMax) <= 0.05) break;
      const bigger = { ...card, photoCm: card.photoCm * 1.05 };
      if (visibleFraction([bigger], 0, input.aspectW, yMax) < 0.62) break;
      card = bigger;
    }
    cards = [clearCaption(card, yMax)];
  }
  for (let round = 0; round < 8; round += 1) {
    const visible = cards.reduce((min, _, index) => Math.min(min, visibleFraction(cards, index, input.aspectW, yMax)), 1);
    if (visible >= POLAROID_MIN_VISIBLE) break;
    cards = relaxCards(cards.map((card) => ({ ...card, photoCm: card.photoCm * 0.9 })), input.aspectW, yMax);
  }
  return cards.map((card) => cellFromCard(card, input.aspectW, input.aspectH));
}

export function polaroidScatterReport(cells: NormRect[], aspectW: number, aspectH: number, yMax = aspectH) {
  const cards = cells.map((cell) => cardFromCell(cell, aspectW, aspectH));
  let minVisible = cards.length ? 1 : 0;
  cards.forEach((_, index) => {
    minVisible = Math.min(minVisible, visibleFraction(cards, index, aspectW, yMax));
  });
  let overlaps = false;
  for (let index = 0; index < cards.length; index += 1) {
    for (let other = index + 1; other < cards.length; other += 1) {
      if (coverFraction(cards, index, other) > 0.03) overlaps = true;
    }
  }
  const pad = Math.min(aspectW, yMax) * 0.12;
  return {
    minVisible,
    background: deskFraction(cards, aspectW, yMax),
    overlaps,
    anchored: cards.every((card) => card.cx >= -pad && card.cx <= aspectW + pad && card.cy >= -pad && card.cy <= yMax + pad),
  };
}
