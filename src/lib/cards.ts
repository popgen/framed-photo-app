import cardsJson from "../../data/cards.json";
import { placeOverlay, type TextOverlay } from "./overlay";

export type CardSize = (typeof cardsJson.sizes)[number];
export type CardTemplate = (typeof cardsJson.templates)[number];

export type CardPhotos = {
  front?: string | null;
  back?: string | null;
  flap?: string | null;
  insideLeft?: string | null;
  insideCenter?: string | null;
  insideRight?: string | null;
};

export type CardSnapshot = {
  sizeId: string;
  quantity: number;
  envelopeColor: string;
  templateId: string;
  frontMessage: TextOverlay | null;
  insideMessage: TextOverlay | null;
  photos: CardPhotos;
  bleed: boolean;
};

export const cardCatalog = cardsJson;
export const cardSizes = cardsJson.sizes;
export const cardTemplates = cardsJson.templates;
export const cardGreetings = cardsJson.greetings;

export const OUTSIDE_PANELS = ["back", "front", "flap"] as const;
export const INSIDE_PANELS = ["insideLeft", "insideCenter", "insideRight"] as const;

const MM = 72 / 25.4;

export function cardSizeById(id: string): CardSize {
  const size = cardSizes.find((item) => item.id === id);
  if (!size) throw new Error(`Tamaño de tarjeta desconocido: ${id}`);
  return size;
}

export function defaultCardSize(): CardSize {
  return cardSizes.find((item) => item.default) ?? cardSizes[0];
}

export function messageLimits(size: CardSize): { front: number; inside: number } {
  const width = size.panelWmm / cardsJson.referencePanelMm.width;
  const height = size.panelHmm / cardsJson.referencePanelMm.height;
  return {
    front: Math.max(24, Math.round(cardsJson.frontMaxChars * width)),
    inside: Math.max(80, Math.round(cardsJson.insideMaxChars * width * height)),
  };
}

export function clampMessage(message: TextOverlay | null, maxChars: number): TextOverlay | null {
  if (!message?.text.trim()) return null;
  const text = [...message.text].slice(0, maxChars).join("");
  return placeOverlay({ ...message, text });
}

export function priceCards(quantity: number): { cents: number; label: string } {
  const qty = Math.max(0, Math.floor(quantity));
  if (qty === 0) return { cents: 0, label: "Sin tarjetas" };
  const packs = [...cardsJson.packs].sort((a, b) => b.qty - a.qty);
  let left = qty;
  let cents = 0;
  const parts: string[] = [];
  for (const pack of packs) {
    const count = Math.floor(left / pack.qty);
    if (!count) continue;
    cents += count * pack.cents;
    left -= count * pack.qty;
    parts.push(`${count}×${pack.qty}`);
  }
  if (left) {
    cents += left * cardsJson.unitCents;
    parts.push(`${left} suelta${left === 1 ? "" : "s"}`);
  }
  const label = qty === 1 ? "1 tarjeta" : `${qty} tarjetas (${parts.join(" + ")})`;
  return { cents, label };
}

export function sheetBox(size: CardSize, bleed: boolean) {
  const bleedMm = bleed ? cardsJson.bleedMm : 0;
  const markMm = bleed ? cardsJson.markMm : 0;
  const pad = bleedMm + markMm;
  return {
    pageWmm: roundMm(size.flatWmm + pad * 2),
    pageHmm: roundMm(size.flatHmm + pad * 2),
    trimWmm: size.flatWmm,
    trimHmm: size.flatHmm,
    trimXmm: pad,
    trimYmm: pad,
    bleedMm,
    panelWmm: size.panelWmm,
    panelHmm: size.panelHmm,
  };
}

export function pagePoints(size: CardSize, bleed: boolean) {
  const box = sheetBox(size, bleed);
  return { width: mmToPt(box.pageWmm), height: mmToPt(box.pageHmm) };
}

export function mmToPt(mm: number): number {
  return mm * MM;
}

export function envelopeBox(size: CardSize) {
  return { widthMm: size.envelopeWmm, heightMm: size.envelopeHmm, name: size.envelopeName };
}

function roundMm(value: number): number {
  return Math.round(value * 100) / 100;
}
