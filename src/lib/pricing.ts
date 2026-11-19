import { GIFT_NOTE_CENTS } from "./gift-note";

export const GIFT_WRAP_CENTS = 1000;
export const SECOND_FRAME_PERCENT = 20;
export const SET_PERCENT = 15;
export const REFERRAL_FRIEND_CENTS = 1500;
export const REFERRAL_REWARD_CENTS = 1500;
export const LOW_STOCK_AT = 5;

export type PromoKind = "percent" | "fixed";

export type PromoRule = {
  code: string;
  kind: PromoKind;
  value: number;
  expiresAt?: string | null;
  maxUses?: number | null;
  usedCount: number;
  active: boolean;
};

export type QuoteItem = { unitPriceCents: number; quantity?: number; kind?: "frame" | "plain" };

export type QuoteInput = {
  items: QuoteItem[];
  giftWrap?: boolean;
  giftNote?: boolean;
  promo?: PromoRule | null;
  promoCode?: string | null;
  referralDiscountCents?: number | null;
  referralError?: string | null;
  creditAvailableCents?: number;
  useCredit?: boolean;
  giftCardBalanceCents?: number | null;
  giftCardError?: string | null;
  now?: Date;
};

export type Quote = {
  unitCount: number;
  subtotalCents: number;
  frameDiscountCents: number;
  frameDiscountLabel: string | null;
  promoDiscountCents: number;
  promoError: string | null;
  referralDiscountCents: number;
  referralError: string | null;
  creditAppliedCents: number;
  giftCardAppliedCents: number;
  giftCardError: string | null;
  giftWrapCents: number;
  giftNoteCents: number;
  totalCents: number;
};

export function quote(input: QuoteInput): Quote {
  const now = input.now ?? new Date();
  let frameSubtotal = 0;
  let plainSubtotal = 0;
  let frameUnits = 0;
  let units = 0;
  let cheaper = Number.POSITIVE_INFINITY;
  for (const item of input.items) {
    const qty = item.quantity ?? 1;
    if (qty < 1) continue;
    const line = item.unitPriceCents * qty;
    units += qty;
    if ((item.kind ?? "frame") === "plain") {
      plainSubtotal += line;
      continue;
    }
    frameSubtotal += line;
    frameUnits += qty;
    if (item.unitPriceCents < cheaper) cheaper = item.unitPriceCents;
  }
  const subtotal = frameSubtotal + plainSubtotal;

  let frameDiscount = 0;
  let frameLabel: string | null = null;
  if (frameUnits >= 3) {
    frameDiscount = Math.round((frameSubtotal * SET_PERCENT) / 100);
    frameLabel = "Set de 3 o más al 15%";
  } else if (frameUnits === 2 && Number.isFinite(cheaper)) {
    frameDiscount = Math.round((cheaper * SECOND_FRAME_PERCENT) / 100);
    frameLabel = "Segundo marco al 20%";
  }

  let merchandise = Math.max(0, subtotal - frameDiscount);
  let promoDiscount = 0;
  let promoError: string | null = null;
  const code = input.promoCode?.trim();
  if (code) {
    const promo = input.promo;
    if (!promo || promo.code.toUpperCase() !== code.toUpperCase()) promoError = "Ese código no existe.";
    else if (!promo.active) promoError = "Ese código ya no está activo.";
    else if (promo.expiresAt && now.getTime() > new Date(promo.expiresAt).getTime()) promoError = "Ese código ya venció.";
    else if (promo.maxUses != null && promo.usedCount >= promo.maxUses) promoError = "Ese código ya se agotó.";
    else if (promo.kind === "percent") promoDiscount = Math.min(merchandise, Math.round((merchandise * promo.value) / 100));
    else promoDiscount = Math.min(merchandise, Math.max(0, promo.value));
  }
  merchandise -= promoDiscount;

  let referralDiscount = 0;
  const referralError = input.referralError ?? null;
  if (!referralError && input.referralDiscountCents) {
    referralDiscount = Math.min(merchandise, Math.max(0, input.referralDiscountCents));
  }
  merchandise -= referralDiscount;

  const giftWrapCents = input.giftWrap ? GIFT_WRAP_CENTS : 0;
  const giftNoteCents = input.giftNote ? GIFT_NOTE_CENTS : 0;
  let total = merchandise + giftWrapCents + giftNoteCents;
  let creditApplied = 0;
  if (input.useCredit && (input.creditAvailableCents ?? 0) > 0) {
    creditApplied = Math.min(total, input.creditAvailableCents ?? 0);
    total -= creditApplied;
  }

  let giftCardApplied = 0;
  const giftCardError = input.giftCardError ?? null;
  if (!giftCardError && input.giftCardBalanceCents != null && input.giftCardBalanceCents > 0) {
    giftCardApplied = Math.min(total, input.giftCardBalanceCents);
    total -= giftCardApplied;
  }

  return {
    unitCount: units,
    subtotalCents: subtotal,
    frameDiscountCents: frameDiscount,
    frameDiscountLabel: frameLabel,
    promoDiscountCents: promoDiscount,
    promoError,
    referralDiscountCents: referralDiscount,
    referralError,
    creditAppliedCents: creditApplied,
    giftCardAppliedCents: giftCardApplied,
    giftCardError,
    giftWrapCents,
    giftNoteCents,
    totalCents: Math.max(0, total),
  };
}
