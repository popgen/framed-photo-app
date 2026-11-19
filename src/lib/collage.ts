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
export type CollageBackground = "white" | "cream" | "red" | "black";
export type TemplateId = "lado" | "hero" | "grid2" | "grid23" | "grid33" | "mosaic" | "navidad";
export type NormRect = { x: number; y: number; w: number; h: number };

export type CollageSource = {
  photoId: string;
  storagePath?: string | null;
  width: number;
  height: number;
  crop: Crop;
  cell: NormRect;
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
];

export const TEMPLATES: { id: TemplateId; name: string; min: number; max: number }[] = [
  { id: "lado", name: "Lado a lado", min: 2, max: 2 },
  { id: "hero", name: "Una grande y dos", min: 3, max: 3 },
  { id: "grid2", name: "Cuadrícula de 4", min: 4, max: 4 },
  { id: "grid23", name: "Cuadrícula de 6", min: 6, max: 6 },
  { id: "grid33", name: "Cuadrícula de 9", min: 9, max: 9 },
  { id: "mosaic", name: "Mosaico", min: 2, max: 12 },
  { id: "navidad", name: "Navidad", min: 2, max: 12 },
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
}): NormRect[] {
  if (!templateFits(input.templateId, input.count)) {
    throw new Error(`La plantilla no acepta ${input.count} fotos.`);
  }
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
}): CollageSnapshot {
  const aspect = printAspect(input.printWcm, input.printHcm, input.orientation);
  const cells = layoutCells({
    templateId: input.templateId,
    count: input.photos.length,
    spacing: input.spacing,
    caption: input.caption,
    aspectW: aspect.w,
    aspectH: aspect.h,
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
    sources: input.photos.map((photo, index) => ({
      photoId: photo.photoId,
      width: photo.width,
      height: photo.height,
      crop: photo.crop,
      cell: cells[index],
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
