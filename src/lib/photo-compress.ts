import { cmToPx, DPI_GOOD } from "./print-size";

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const MAX_BUCKET_BYTES = 10 * 1024 * 1024;
export const JPEG_QUALITIES = [0.95, 0.9, 0.85, 0.8] as const;
export const DPI_FLOOR = 200;
export const PHOTO_TOO_LARGE = "Esta foto sigue siendo muy pesada después de optimizarla. Prueba con una imagen un poco más chica.";

export type CompressStep = { quality: number; longEdge: number };

export function longestPrintEdge(printWcm: number, printHcm: number, dpi: number): number {
  return cmToPx(Math.max(printWcm, printHcm), dpi);
}

export function buildCompressSteps(args: { width: number; height: number; printWcm: number; printHcm: number }): CompressStep[] {
  const longEdge = Math.max(args.width, args.height);
  const edge300 = longestPrintEdge(args.printWcm, args.printHcm, DPI_GOOD);
  const edge200 = longestPrintEdge(args.printWcm, args.printHcm, DPI_FLOOR);
  const steps: CompressStep[] = JPEG_QUALITIES.map((quality) => ({ quality, longEdge }));
  let cursor = longEdge;
  const shrinkTo = (target: number) => {
    if (cursor <= target) return;
    while (Math.round(cursor * 0.85) > target) {
      cursor = Math.round(cursor * 0.85);
      steps.push({ quality: 0.8, longEdge: cursor });
    }
    steps.push({ quality: 0.8, longEdge: target });
    cursor = target;
  };
  if (longEdge > edge300) shrinkTo(edge300);
  if (cursor > edge200) shrinkTo(edge200);
  return steps;
}

export function pickCompressed(originalBytes: number, attemptBytes: number[]): { action: "original" } | { action: "attempt"; index: number } | { action: "reject" } {
  if (originalBytes <= MAX_UPLOAD_BYTES) return { action: "original" };
  const fit = attemptBytes.findIndex((bytes) => bytes <= MAX_UPLOAD_BYTES);
  if (fit >= 0) return { action: "attempt", index: fit };
  const last = attemptBytes.length - 1;
  if (last >= 0 && attemptBytes[last] <= MAX_BUCKET_BYTES) return { action: "attempt", index: last };
  return { action: "reject" };
}
