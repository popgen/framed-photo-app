export const SELFIE_EDGE = 800;
export const SELFIE_QUALITY = 0.85;

export function selfieCropSquare(width: number, height: number): { sx: number; sy: number; size: number } {
  const safeW = Math.max(1, Math.round(width));
  const safeH = Math.max(1, Math.round(height));
  const size = Math.min(safeW, safeH);
  return {
    sx: Math.floor((safeW - size) / 2),
    sy: Math.floor((safeH - size) / 2),
    size,
  };
}

export function selfieOutputEdge(sourceSize: number, max = SELFIE_EDGE): number {
  const size = Math.max(1, Math.round(sourceSize));
  return Math.min(max, size);
}

export function selfieObjectPath(): string {
  return `uploads/selfies/${crypto.randomUUID()}.jpg`;
}

type Drawable = CanvasImageSource & { width?: number; height?: number; videoWidth?: number; videoHeight?: number };

export async function encodeSelfie(source: Drawable, width: number, height: number): Promise<Blob> {
  const crop = selfieCropSquare(width, height);
  const edge = selfieOutputEdge(crop.size);
  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(edge, edge) : Object.assign(document.createElement("canvas"), { width: edge, height: edge });
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
  if (!ctx) throw new Error("No pudimos preparar la selfie.");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, crop.sx, crop.sy, crop.size, crop.size, 0, 0, edge, edge);
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type: "image/jpeg", quality: SELFIE_QUALITY });
  return new Promise((resolve, reject) => {
    (canvas as HTMLCanvasElement).toBlob((blob) => (blob ? resolve(blob) : reject(new Error("No pudimos preparar la selfie."))), "image/jpeg", SELFIE_QUALITY);
  });
}
