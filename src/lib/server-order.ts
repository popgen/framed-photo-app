import { cardMessageError, priceCards } from "./cards";
import { framedPriceCents } from "./collage";
import { EXAMPLE_PHOTO_PROMPT, usesExamplePhoto } from "./example-photo";
import { frameById } from "./catalog";
import { defaultCampaign } from "./campaign";
import { guaranteeFor } from "./cutoff";
import { estimateDelivery } from "./delivery";
import { expandNeeds } from "./inventory";
import { normalizePhone } from "./phone";
import { REFERRAL_FRIEND_CENTS, quote, type QuoteItem } from "./pricing";
import { shippingZone } from "./zone";
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
  const promoCode = input.promoCode?.trim() || null;
  const promo = promoCode ? (ctx.promos.find((item) => item.code.toUpperCase() === promoCode.toUpperCase()) ?? null) : null;
  const referralCode = input.referralCode?.trim() || "";
  const referral = referralCode ? (ctx.referrals ?? []).find((item) => item.code.toUpperCase() === referralCode.toUpperCase()) : null;
  let referralError: string | null = null;
  let referralDiscount: number | null = null;
  if (referralCode) {
    if (!referral) referralError = "Ese código de amigo no existe.";
    else if (referral.ownerPhone === phone) referralError = "No puedes usar tu propio código.";
    else referralDiscount = referral.friendDiscountCents || REFERRAL_FRIEND_CENTS;
  }
  const giftCode = input.giftCardCode?.trim() || "";
  const gift = giftCode ? (ctx.giftCards ?? []).find((item) => item.code.toUpperCase() === giftCode.toUpperCase()) : null;
  let giftCardError: string | null = null;
  let giftCardBalance: number | null = null;
  if (giftCode) {
    if (!gift || gift.status !== "active" || gift.balanceCents <= 0) giftCardError = "Esa tarjeta de regalo no tiene saldo.";
    else giftCardBalance = gift.balanceCents;
  }
  const priced = quote({
    items: quoteLines(input),
    giftWrap: input.giftWrap && input.items.some((item) => !item.card),
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
  };
}
