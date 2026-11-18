import cardsJson from "../../data/cards.json";
import { placeOverlay, type TextOverlay } from "./overlay";
import type { Crop } from "./print-size";

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
  frontCrop?: Crop | null;
  insideCrop?: Crop | null;
  layout?: "diptych";
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

export function cardSheetCopy(size: CardSize): string {
  if (size.id === "5x7") {
    const flag = "shopFlag" in size && size.shopFlag ? ` ${size.shopFlag}` : "";
    return `Díptico con pliegue arriba. Cada panel mide 5×7 pulgadas y la hoja abierta mide 5×14 pulgadas.${flag}`;
  }
  return `Díptico con pliegue arriba. Cada panel mide ${size.panelWmm}×${size.panelHmm} mm y la hoja abierta mide ${size.flatWmm}×${size.flatHmm} mm, así que cabe en una A4. Sobre ${size.envelopeName} ${size.envelopeWmm}×${size.envelopeHmm} mm.`;
}

export function cardOrderLine(card: Pick<CardSnapshot, "sizeId">): string {
  const size = cardSizeById(card.sizeId);
  if (size.id === "5x7") return "Díptico, pliegue arriba. Hoja abierta 5×14 pulgadas.";
  return `Díptico, pliegue arriba. Hoja abierta ${size.flatWmm}×${size.flatHmm} mm.`;
}

export function messageLimits(_size?: CardSize): { front: number; inside: number } {
  return { front: cardsJson.messageMaxChars, inside: cardsJson.messageMaxChars };
}

export function cardMessageError(items: Array<{ card?: { frontMessage?: { text?: string } | null; insideMessage?: { text?: string } | null } | null }> | null | undefined): string | null {
  const max = cardsJson.messageMaxChars;
  for (const item of items ?? []) {
    const texts = [item?.card?.frontMessage?.text, item?.card?.insideMessage?.text];
    if (texts.some((text) => typeof text === "string" && [...text].length > max)) {
      return `El mensaje de la tarjeta puede tener hasta ${max} caracteres.`;
    }
  }
  return null;
}

export function clampMessage(message: TextOverlay | null, maxChars: number): TextOverlay | null {
  if (!message?.text.trim()) return null;
  const text = [...message.text].slice(0, maxChars).join("");
  return placeOverlay({ ...message, text }, false, true);
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
