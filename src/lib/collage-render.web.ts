import {
  CAPTION_BAND,
  NAVIDAD_CAPTION_BAND,
  backgroundHex,
  captionColor,
  cellPixels,
  compositePixels,
  fitCompositeSize,
  polaroidCard,
  type CollageSnapshot,
  type NormRect,
} from "./collage";

export async function renderCollageBlob(snapshot: CollageSnapshot, images: CanvasImageSource[]): Promise<Blob> {
  if (images.length !== snapshot.sources.length) throw new Error("Faltan fotos para armar la impresión.");
  const ideal = compositePixels(snapshot.printWcm, snapshot.printHcm, snapshot.orientation);
  const size = drawSize(ideal.width, ideal.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no pudo preparar la impresión.");
  paint(ctx, snapshot, images, size.width, size.height);
  return blobFrom(canvas);
}

function drawSize(width: number, height: number) {
  const fitted = fitCompositeSize(width, height);
  if (fitted.scale === 1) return fitted;
  return fitted;
}

function paint(ctx: CanvasRenderingContext2D, snapshot: CollageSnapshot, images: CanvasImageSource[], width: number, height: number) {
  ctx.fillStyle = backgroundHex(snapshot.background);
  ctx.fillRect(0, 0, width, height);
  if (snapshot.templateId === "navidad") drawFestiveBorder(ctx, width, height);
  if (snapshot.templateId === "polaroids") {
    snapshot.sources.forEach((source, index) => {
      drawPolaroid(ctx, images[index], source.crop, source.cell, source.rotation ?? source.cell.rotation ?? 0, width, height);
    });
  } else {
    snapshot.sources.forEach((source, index) => {
      const rect = cellPixels(source.cell, width, height);
      const radius = snapshot.rounded ? Math.min(rect.w, rect.h) * 0.12 : 0;
      ctx.save();
      clipRound(ctx, rect.x, rect.y, rect.w, rect.h, radius);
      const crop = source.crop;
      ctx.drawImage(images[index], crop.x, crop.y, crop.width, crop.height, rect.x, rect.y, rect.w, rect.h);
      ctx.restore();
    });
  }
  if (snapshot.caption) drawCaption(ctx, snapshot, width, height);
}

function drawPolaroid(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  crop: CollageSnapshot["sources"][number]["crop"],
  photo: NormRect,
  rotation: number,
  width: number,
  height: number,
) {
  const card = polaroidCard(photo, width, height);
  const cardX = card.x * width;
  const cardY = card.y * height;
  const cardW = card.w * width;
  const cardH = card.h * height;
  const photoX = photo.x * width;
  const photoY = photo.y * height;
  const photoW = photo.w * width;
  const photoH = photo.h * height;
  const cx = cardX + cardW / 2;
  const cy = cardY + cardH / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.shadowColor = "rgba(36, 23, 20, 0.32)";
  ctx.shadowBlur = Math.max(8, width * 0.014);
  ctx.shadowOffsetX = width * 0.004;
  ctx.shadowOffsetY = Math.max(6, height * 0.01);
  ctx.fillStyle = "#FFFEFB";
  ctx.fillRect(cardX - cx, cardY - cy, cardW, cardH);
  ctx.shadowColor = "rgba(0, 0, 0, 0)";
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  const localX = photoX - cx;
  const localY = photoY - cy;
  ctx.save();
  ctx.beginPath();
  ctx.rect(localX, localY, photoW, photoH);
  ctx.clip();
  ctx.drawImage(image, crop.x, crop.y, crop.width, crop.height, localX, localY, photoW, photoH);
  ctx.restore();
  ctx.restore();
}

function drawFestiveBorder(ctx: CanvasRenderingContext2D, width: number, height: number) {
  const outer = Math.round(Math.min(width, height) * 0.028);
  const inner = Math.round(Math.min(width, height) * 0.048);
  ctx.strokeStyle = "#B9832F";
  ctx.lineWidth = Math.max(2, Math.round(width * 0.006));
  ctx.strokeRect(outer, outer, width - outer * 2, height - outer * 2);
  ctx.strokeStyle = "#1C4D3A";
  ctx.lineWidth = Math.max(1, Math.round(width * 0.003));
  ctx.strokeRect(inner, inner, width - inner * 2, height - inner * 2);
  const dots = 16;
  ctx.fillStyle = "#C5363C";
  for (let i = 0; i < dots; i += 1) {
    const t = i / dots;
    const along = outer + (width - outer * 2) * t;
    const down = outer + (height - outer * 2) * t;
    const radius = Math.max(3, width * 0.006);
    ctx.beginPath();
    ctx.arc(along, outer, radius, 0, Math.PI * 2);
    ctx.arc(along, height - outer, radius, 0, Math.PI * 2);
    ctx.fill();
    if (i % 2 === 0) {
      ctx.beginPath();
      ctx.arc(outer, down, radius, 0, Math.PI * 2);
      ctx.arc(width - outer, down, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function drawCaption(ctx: CanvasRenderingContext2D, snapshot: CollageSnapshot, width: number, height: number) {
  const band = snapshot.templateId === "navidad" ? NAVIDAD_CAPTION_BAND : CAPTION_BAND;
  const size = Math.max(18, Math.round(height * band * 0.42));
  ctx.fillStyle = captionColor(snapshot.background);
  ctx.font = `600 ${size}px Georgia, "Times New Roman", serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(snapshot.caption, width / 2, height * (1 - band / 2), width * 0.9);
}

function clipRound(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number) {
  const r = Math.max(0, Math.min(radius, w / 2, h / 2));
  ctx.beginPath();
  if (r <= 0 || typeof ctx.roundRect !== "function") ctx.rect(x, y, w, h);
  else ctx.roundRect(x, y, w, h, r);
  ctx.clip();
}

function blobFrom(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("No pudimos preparar la impresión."))), "image/jpeg", 0.92);
  });
}
