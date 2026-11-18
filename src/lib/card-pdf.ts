import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  cardSizeById,
  cardTemplates,
  envelopeBox,
  messageLimits,
  mmToPt,
  sheetBox,
  type CardSnapshot,
} from "./cards";
import { CARD_TEXT_MIN_PT, layoutCardText } from "./card-text";
import { fontById } from "./overlay";

export type FontBytes = Record<string, Uint8Array>;
export type PanelImages = Partial<Record<"front" | "inside" | "back" | "insideCenter" | "insideLeft" | "flap", Uint8Array>>;

const INK = rgb(0.14, 0.09, 0.08);

export async function buildCardPdf(card: CardSnapshot, fonts: FontBytes, images: PanelImages = {}): Promise<Uint8Array> {
  const size = cardSizeById(card.sizeId);
  const template = cardTemplates.find((item) => item.id === card.templateId) ?? cardTemplates[0];
  const limits = messageLimits(size);
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Tarjeta ${size.name}`);
  doc.setSubject(
    size.printShop
      ? "Se imprime en un taller, con cartulina grande."
      : `Díptico ${size.flatWmm}×${size.flatHmm} mm, sobre ${size.envelopeName}`,
  );
  const embedded = new Map<string, PDFFont>();
  for (const [id, bytes] of Object.entries(fonts)) {
    if (bytes?.byteLength) embedded.set(id, await doc.embedFont(bytes));
  }
  const fallback = embedded.get("pacifico") ?? embedded.values().next().value;
  if (!fallback) throw new Error("Falta la fuente para la tarjeta.");

  await drawSheet(doc, {
    size,
    bleed: card.bleed,
    outside: template.outside,
    inside: template.inside,
    images,
    front: clip(card.frontMessage, limits.front),
    insideMessage: clip(card.insideMessage, limits.inside),
    fonts: embedded,
    fallback,
  });
  drawBack(doc, size, fallback);
  if (!card.bleed) drawGuide(doc, size);
  drawEnvelope(doc, size, card.envelopeColor);
  return doc.save();
}

function clip(message: CardSnapshot["frontMessage"], max: number) {
  if (!message?.text.trim()) return null;
  return { ...message, text: [...message.text].slice(0, max).join("") };
}

async function drawSheet(
  doc: PDFDocument,
  args: {
    size: ReturnType<typeof cardSizeById>;
    bleed: boolean;
    outside: string;
    inside: string;
    images: PanelImages;
    front: CardSnapshot["frontMessage"];
    insideMessage: CardSnapshot["frontMessage"];
    fonts: Map<string, PDFFont>;
    fallback: PDFFont;
  },
) {
  const box = sheetBox(args.size, args.bleed);
  const page = doc.addPage([mmToPt(box.pageWmm), mmToPt(box.pageHmm)]);
  const trimX = mmToPt(box.trimXmm);
  const trimY = mmToPt(box.trimYmm);
  const panelW = mmToPt(box.panelWmm);
  const panelH = mmToPt(box.panelHmm);
  page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: hex(args.inside) });
  page.drawRectangle({ x: trimX, y: trimY + panelH, width: panelW, height: panelH, color: hex(args.outside) });
  const insideImage = args.images.inside ?? args.images.insideCenter ?? args.images.insideLeft;
  await paint(doc, page, insideImage, trimX, trimY, panelW, panelH);
  await paint(doc, page, args.images.front, trimX, trimY + panelH, panelW, panelH);
  if (args.insideMessage?.text) {
    drawMessage(page, args.insideMessage, trimX, trimY, panelW, panelH, args.fonts.get(args.insideMessage.font) ?? args.fallback);
  }
  if (args.front?.text) {
    drawMessage(page, args.front, trimX, trimY + panelH, panelW, panelH, args.fonts.get(args.front.font) ?? args.fallback);
  }
  if (args.bleed) {
    drawCrops(page, trimX, trimY, mmToPt(box.trimWmm), mmToPt(box.trimHmm));
    drawFoldTicks(page, trimX, trimY, panelW, panelH, mmToPt(box.bleedMm));
  }
}

async function paint(doc: PDFDocument, page: PDFPage, image: Uint8Array | undefined, x: number, y: number, w: number, h: number) {
  if (!image?.byteLength) return;
  const embedded = await doc.embedJpg(image).catch(async () => doc.embedPng(image));
  page.drawImage(embedded, { x, y, width: w, height: h });
}

function drawBack(doc: PDFDocument, size: ReturnType<typeof cardSizeById>, font: PDFFont) {
  const page = doc.addPage([mmToPt(size.panelWmm), mmToPt(size.panelHmm)]);
  page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: rgb(0.97, 0.95, 0.93) });
  const label = "Mi Fotito";
  const fontSize = 16;
  const width = font.widthOfTextAtSize(label, fontSize);
  page.drawText(label, {
    x: (page.getWidth() - width) / 2,
    y: page.getHeight() / 2 - fontSize / 2,
    size: fontSize,
    font,
    color: rgb(0.62, 0.16, 0.2),
  });
}

function drawMessage(page: PDFPage, message: NonNullable<CardSnapshot["frontMessage"]>, x: number, y: number, w: number, h: number, font: PDFFont) {
  // Script faces paint wider than the measured advance, so the lines wrap a little early.
  const measure = (line: string, size: number) => font.widthOfTextAtSize(line || " ", size) * 1.22;
  const fitted = layoutCardText(message.text, w, h, measure, message.size * h, CARD_TEXT_MIN_PT);
  const block = fitted.lines.length * fitted.leading;
  const paragraph = message.text.includes("\n") || [...message.text].length > 48;
  const center = paragraph ? y + h / 2 : y + (1 - Math.min(0.86, Math.max(0.14, message.y))) * h;
  let baseline = center + block / 2 - fitted.size;
  const topLimit = y + h - fitted.size * 0.35;
  const bottomLimit = y + fitted.size * 0.35 + Math.max(0, fitted.lines.length - 1) * fitted.leading;
  if (baseline > topLimit) baseline = topLimit;
  if (baseline < bottomLimit) baseline = bottomLimit;
  const cx = x + (paragraph ? 0.5 : Math.min(0.86, Math.max(0.14, message.x))) * w;
  fitted.lines.forEach((line, index) => {
    const width = measure(line, fitted.size);
    page.drawText(line, {
      x: cx - width / 2,
      y: baseline - index * fitted.leading,
      size: fitted.size,
      font,
      color: hex(message.color),
    });
  });
}

function drawCrops(page: PDFPage, x: number, y: number, w: number, h: number) {
  const mark = mmToPt(3.5);
  const gap = mmToPt(1);
  const corners = [
    [x, y, -1, -1],
    [x + w, y, 1, -1],
    [x, y + h, -1, 1],
    [x + w, y + h, 1, 1],
  ] as const;
  for (const [cx, cy, sx, sy] of corners) {
    page.drawLine({ start: { x: cx + sx * gap, y: cy }, end: { x: cx + sx * (gap + mark), y: cy }, thickness: 0.4, color: INK });
    page.drawLine({ start: { x: cx, y: cy + sy * gap }, end: { x: cx, y: cy + sy * (gap + mark) }, thickness: 0.4, color: INK });
  }
}

function drawFoldTicks(page: PDFPage, x: number, y: number, panelW: number, panelH: number, bleed: number) {
  const fold = y + panelH;
  page.drawLine({ start: { x: x - bleed, y: fold }, end: { x, y: fold }, thickness: 0.3, color: rgb(0.4, 0.4, 0.4) });
  page.drawLine({ start: { x: x + panelW, y: fold }, end: { x: x + panelW + bleed, y: fold }, thickness: 0.3, color: rgb(0.4, 0.4, 0.4) });
}

function drawGuide(doc: PDFDocument, size: ReturnType<typeof cardSizeById>) {
  const box = sheetBox(size, false);
  const page = doc.addPage([mmToPt(box.pageWmm), mmToPt(box.pageHmm)]);
  page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: rgb(1, 1, 1) });
  const fold = mmToPt(size.panelHmm);
  page.drawLine({
    start: { x: 0, y: fold },
    end: { x: page.getWidth(), y: fold },
    thickness: 0.4,
    color: rgb(0.7, 0.7, 0.7),
    dashArray: [2, 3],
  });
}

function drawEnvelope(doc: PDFDocument, size: ReturnType<typeof cardSizeById>, colorId: string) {
  const envelope = envelopeBox(size);
  const page = doc.addPage([mmToPt(envelope.widthMm), mmToPt(envelope.heightMm)]);
  const fill = colorId === "red" ? "#8E1E2A" : colorId === "kraft" ? "#C4924A" : "#F7F4EF";
  page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: hex(fill) });
  page.drawRectangle({
    x: mmToPt(4),
    y: mmToPt(4),
    width: page.getWidth() - mmToPt(8),
    height: page.getHeight() - mmToPt(8),
    borderColor: INK,
    borderWidth: 0.6,
  });
}

function hex(value: string) {
  const raw = value.replace("#", "");
  const n = Number.parseInt(raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw, 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

export function fontFileFor(id: string): string {
  return fontById(id).family;
}
