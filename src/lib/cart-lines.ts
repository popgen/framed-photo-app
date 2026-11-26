import { priceCards } from "./cards";
import { findFrame } from "./catalog";
import { framedPriceCents } from "./collage";
import type { QuoteItem } from "./pricing";
import { isTestProductItem, TEST_PRODUCT_CENTS } from "./test-product";
import { VOICE_ADDON_CENTS } from "./voice";

type CartLineItem = {
  frameId: string;
  card?: { quantity: number } | null;
  collage?: unknown;
  voice?: { addonCents?: number } | null;
  testProduct?: boolean | null;
};

/**
 * Price lines for a cart, the same way the server prices an order:
 * test product, Christmas card (no frame in the catalog), or a framed photo, plus any voice add-on.
 * The cart and checkout screens both use this so a card never goes through frameById.
 */
export function cartQuoteLines(items: CartLineItem[] | null | undefined): QuoteItem[] {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item): QuoteItem[] => {
    if (!item || typeof item !== "object") return [];
    if (isTestProductItem(item)) return [{ unitPriceCents: TEST_PRODUCT_CENTS, quantity: 1, kind: "plain" }];
    if (item.card) {
      const lines: QuoteItem[] = [{ unitPriceCents: priceCards(item.card.quantity).cents, quantity: 1, kind: "plain" }];
      if (item.voice) lines.push({ unitPriceCents: item.voice.addonCents || VOICE_ADDON_CENTS, quantity: 1, kind: "plain" });
      return lines;
    }
    const frame = findFrame(item.frameId);
    if (!frame) return [];
    const lines: QuoteItem[] = [{ unitPriceCents: framedPriceCents(frame.priceCents, Boolean(item.collage)), quantity: 1, kind: "frame" }];
    if (item.voice) lines.push({ unitPriceCents: item.voice.addonCents || VOICE_ADDON_CENTS, quantity: 1, kind: "plain" });
    return lines;
  });
}
