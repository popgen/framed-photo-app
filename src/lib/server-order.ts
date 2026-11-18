import { priceCards } from "./cards";
import { frameById } from "./catalog";
import { defaultCampaign } from "./campaign";
import { guaranteeFor } from "./cutoff";
import { estimateDelivery } from "./delivery";
import { expandNeeds } from "./inventory";
import { normalizePhone } from "./phone";
import { quote, type QuoteItem } from "./pricing";
import { shippingZone } from "./zone";
import { VOICE_ADDON_CENTS } from "./voice";
import type { CheckoutInput, Promo } from "./types";

export function quoteLines(input: CheckoutInput): QuoteItem[] {
  return input.items.flatMap((item) => {
    const lines: QuoteItem[] = item.card
      ? [{ unitPriceCents: priceCards(item.card.quantity).cents, quantity: 1, kind: "plain" }]
      : [{ unitPriceCents: frameById(item.frameId).priceCents, quantity: 1, kind: "frame" }];
    if (item.voice) lines.push({ unitPriceCents: item.voice.addonCents || VOICE_ADDON_CENTS, quantity: 1, kind: "plain" });
    return lines;
  });
}

export function stockNeeds(input: CheckoutInput) {
  return expandNeeds(
    input.items
      .filter((item) => !item.card)
      .map((item) => ({ consumes: frameById(item.frameId).consumes, quantity: 1 })),
  );
}

export function evaluateOrder(input: CheckoutInput, ctx: { promos: Promo[]; stock: Record<string, number> }) {
  const phone = normalizePhone(input.phone);
  if (!phone) return { error: "Revisa el celular." };
  if (!input.items.length) return { error: "Tu carrito está vacío." };
  const promoCode = input.promoCode?.trim() || null;
  const promo = promoCode ? (ctx.promos.find((item) => item.code.toUpperCase() === promoCode.toUpperCase()) ?? null) : null;
  const priced = quote({
    items: quoteLines(input),
    giftWrap: input.giftWrap && input.items.some((item) => !item.card),
    promo,
    promoCode,
  });
  if (priced.promoError) return { error: priced.promoError };
  const needs = stockNeeds(input);
  const missing = Object.entries(needs).filter(([sku, qty]) => (ctx.stock[sku] ?? 0) < qty).map(([sku]) => sku);
  if (missing.length) return { error: `No hay stock suficiente (${missing.join(", ")}).` };
  const zone = shippingZone(input.department, input.province, input.district || "");
  const now = new Date();
  const guarantee = guaranteeFor(now, zone, defaultCampaign);
  const eta = estimateDelivery(now, zone);
  return {
    phone,
    priced,
    promo,
    needs,
    zone,
    christmasGuaranteed: guarantee.guaranteed,
    christmasNote: `${guarantee.headline}. ${guarantee.detail}`,
    etaMin: eta.min,
    etaMax: eta.max,
    etaLabel: eta.label,
  };
}
