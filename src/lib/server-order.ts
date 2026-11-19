import { cardMessageError, priceCards } from "./cards";
import { framedPriceCents } from "./collage";
import { EXAMPLE_PHOTO_PROMPT, usesExamplePhoto } from "./example-photo";
import { frameById } from "./catalog";
import { defaultCampaign } from "./campaign";
import { guaranteeFor } from "./cutoff";
import { estimateDelivery } from "./delivery";
import { expandNeeds } from "./inventory";
import { resolveDiscountInput } from "./discount-code";
import { normalizePhone } from "./phone";
import { quote, type QuoteItem } from "./pricing";
import { shippingZone } from "./zone";
import { chargedGiftWrap, hidePricesForOrder } from "./gift-wrap";
import { giftNoteFromCheckout } from "./gift-note";
import { VOICE_ADDON_CENTS } from "./voice";
import type { CheckoutInput, GiftCard, Promo, Referral } from "./types";

export function quoteLines(input: CheckoutInput): QuoteItem[] {
  return input.items.flatMap((item) => {
    const lines: QuoteItem[] = item.card
      ? [{ unitPriceCents: priceCards(item.card.quantity).cents, quantity: 1, kind: "plain" }]
      : [{ unitPriceCents: framedPriceCents(frameById(item.frameId).priceCents, Boolean(item.collage)), quantity: 1, kind: "frame" }];
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

export function evaluateOrder(input: CheckoutInput, ctx: { promos: Promo[]; stock: Record<string, number>; referrals?: Referral[]; giftCards?: GiftCard[]; credits?: Record<string, number>; enforceStock?: boolean }) {
  const phone = normalizePhone(input.phone);
  if (!phone) return { error: "Revisa el celular." };
  if (!input.items.length) return { error: "Tu carrito está vacío." };
  if (input.items.some((item) => usesExamplePhoto(item))) return { error: EXAMPLE_PHOTO_PROMPT };
  const cardError = cardMessageError(input.items);
  if (cardError) return { error: cardError };
  const resolved = resolveDiscountInput(
    { promoCode: input.promoCode, referralCode: input.referralCode, giftCardCode: input.giftCardCode, phone },
    { promos: ctx.promos, referrals: ctx.referrals ?? [], giftCards: ctx.giftCards ?? [] },
  );
  const { promo, promoCode, referral, referralDiscountCents: referralDiscount, referralError, giftCardBalanceCents: giftCardBalance, giftCardError } = resolved;
  const parsedNote = giftNoteFromCheckout(input);
  if (!parsedNote.ok) return { error: parsedNote.error };
  const giftWrap = chargedGiftWrap(input);
  const priced = quote({
    items: quoteLines(input),
    giftWrap,
    giftNote: Boolean(parsedNote.note),
    promo,
    promoCode,
    referralDiscountCents: referralDiscount,
    referralError,
    creditAvailableCents: ctx.credits?.[phone] ?? 0,
    useCredit: input.useCredit,
    giftCardBalanceCents: giftCardBalance,
    giftCardError,
  });
  if (priced.promoError) return { error: priced.promoError };
  if (priced.referralError) return { error: priced.referralError };
  if (priced.giftCardError) return { error: priced.giftCardError };
  const needs = stockNeeds(input);
  if (ctx.enforceStock !== false) {
    const missing = Object.entries(needs).filter(([sku, qty]) => (ctx.stock[sku] ?? 0) < qty).map(([sku]) => sku);
    if (missing.length) return { error: `No hay stock suficiente (${missing.join(", ")}).` };
  }
  const zone = shippingZone(input.department, input.province, input.district || "");
  const now = new Date();
  const guarantee = guaranteeFor(now, zone, defaultCampaign);
  const eta = estimateDelivery(now, zone);
  return {
    phone,
    priced,
    promo,
    referral,
    needs,
    zone,
    christmasGuaranteed: guarantee.guaranteed,
    christmasNote: `${guarantee.headline}. ${guarantee.detail}`,
    etaMin: eta.min,
    etaMax: eta.max,
    etaLabel: eta.label,
    giftNote: parsedNote.note,
    isGift: parsedNote.isGift,
    giftWrap,
    hidePrices: hidePricesForOrder(Boolean(parsedNote.note?.hidePrices), giftWrap),
  };
}
