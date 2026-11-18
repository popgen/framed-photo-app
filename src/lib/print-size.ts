export const DPI_GOOD = 300;
export const DPI_ACCEPT = 150;
export const CM_PER_INCH = 2.54;

export type Orientation = "portrait" | "landscape";
export type ResolutionStatus = "good" | "soft" | "low";

export type Crop = {
  imageWidth: number;
  imageHeight: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SizeOption = {
  id: string;
  label: string;
  printWcm: number;
  printHcm: number;
};

export function cmToPx(cm: number, dpi = DPI_GOOD): number {
  return Math.round((cm / CM_PER_INCH) * dpi);
}

export function targetPixels(printWcm: number, printHcm: number, orientation: Orientation, dpi = DPI_GOOD) {
  const square = printWcm === printHcm;
  const wCm = square ? printWcm : orientation === "landscape" ? Math.max(printWcm, printHcm) : Math.min(printWcm, printHcm);
  const hCm = square ? printHcm : orientation === "landscape" ? Math.min(printWcm, printHcm) : Math.max(printWcm, printHcm);
  return { width: cmToPx(wCm, dpi), height: cmToPx(hCm, dpi), wCm, hCm };
}

export function printDpi(cropWidthPx: number, cropHeightPx: number, wCm: number, hCm: number): number {
  const dpiW = cropWidthPx / (wCm / CM_PER_INCH);
  const dpiH = cropHeightPx / (hCm / CM_PER_INCH);
  return Math.min(dpiW, dpiH);
}

export function resolutionStatus(dpi: number): ResolutionStatus {
  // Round first so the exact target pixel size (1772×2362) stays "good"
  // even when the reverse cm→inch conversion lands a hair under 300.
  const shown = Math.round(dpi);
  if (shown >= DPI_GOOD) return "good";
  if (shown >= DPI_ACCEPT) return "soft";
  return "low";
}

export function centeredCrop(imageW: number, imageH: number, aspectW: number, aspectH: number): Crop {
  const target = aspectW / aspectH;
  const image = imageW / imageH;
  let width: number;
  let height: number;
  if (image > target) {
    height = imageH;
    width = imageH * target;
  } else {
    width = imageW;
    height = imageW / target;
  }
  return {
    imageWidth: imageW,
    imageHeight: imageH,
    x: (imageW - width) / 2,
    y: (imageH - height) / 2,
    width,
    height,
  };
}

export function refitCrop(prev: Crop, aspectW: number, aspectH: number): Crop {
  const target = aspectW / aspectH;
  const cx = prev.x + prev.width / 2;
  const cy = prev.y + prev.height / 2;
  let width = prev.width;
  let height = width / target;
  if (height > prev.imageHeight) {
    height = prev.imageHeight;
    width = height * target;
  }
  if (width > prev.imageWidth) {
    width = prev.imageWidth;
    height = width / target;
  }
  const x = clamp(cx - width / 2, 0, prev.imageWidth - width);
  const y = clamp(cy - height / 2, 0, prev.imageHeight - height);
  return { ...prev, x, y, width, height };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function assessResolution(args: {
  cropWidthPx: number;
  cropHeightPx: number;
  printWcm: number;
  printHcm: number;
  orientation: Orientation;
  alternatives?: SizeOption[];
}): {
  dpi: number;
  status: ResolutionStatus;
  suggestion?: SizeOption;
  message: string | null;
} {
  const target = targetPixels(args.printWcm, args.printHcm, args.orientation);
  const dpi = printDpi(args.cropWidthPx, args.cropHeightPx, target.wCm, target.hCm);
  const status = resolutionStatus(dpi);
  const currentArea = target.wCm * target.hCm;
  const currentRatio = target.wCm / target.hCm;
  let suggestion: SizeOption | undefined;
  if (status === "low") {
    const smaller = (args.alternatives ?? [])
      .filter((option) => option.printWcm * option.printHcm < currentArea - 0.01)
      .map((option) => {
        const next = targetPixels(option.printWcm, option.printHcm, args.orientation);
        return {
          option,
          dpi: printDpi(args.cropWidthPx, args.cropHeightPx, next.wCm, next.hCm),
          area: next.wCm * next.hCm,
          ratioGap: Math.abs(next.wCm / next.hCm - currentRatio),
        };
      })
      .filter((option) => Math.round(option.dpi) >= DPI_ACCEPT)
      .sort((a, b) => a.ratioGap - b.ratioGap || b.area - a.area);
    suggestion = smaller[0]?.option;
  }
  const shown = Math.round(dpi);
  let message: string | null = null;
  if (status === "soft") {
    message = `Esta foto está en ${shown} dpi. Se imprime bien, aunque de cerca se verá un poco más suave que a 300 dpi.`;
  } else if (status === "low") {
    message = suggestion
      ? `A ${shown} dpi esta foto queda chica para este tamaño. Te recomendamos ${suggestion.label}.`
      : `A ${shown} dpi la foto no alcanza para una impresión nítida. Elige una imagen más grande.`;
  }
  return { dpi, status, suggestion, message };
}
