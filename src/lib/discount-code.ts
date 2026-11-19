import { formatSoles } from "./money";
import { normalizePhone } from "./phone";
import { REFERRAL_FRIEND_CENTS, quote } from "./pricing";
import type { GiftCard, Promo, Referral } from "./types";

export type DiscountKind = "promo" | "referral" | "gift";

export type DiscountSources = {
  promos: Promo[];
  referrals: Referral[];
  giftCards: GiftCard[];
};

export type DiscountFields = {
  promoCode?: string | null;
  referralCode?: string | null;
  giftCardCode?: string | null;
};

export type ResolvedDiscounts = {
  promo: Promo | null;
  promoCode: string | null;
  referral: Referral | null;
  referralDiscountCents: number | null;
  referralError: string | null;
  giftCard: GiftCard | null;
  giftCardBalanceCents: number | null;
  giftCardError: string | null;
};

export type ClassifiedCode =
  | { ok: true; kind: DiscountKind; code: string; message: string }
  | { ok: false; error: string };

export type AppliedDiscountFields = {
  promoCode: string;
  referralCode: string;
  giftCardCode: string;
};

export type AppliedDiscountChip = {
  kind: DiscountKind;
  code: string;
  label: string;
};

const GIFT_PREFIX = "REGALO-";
const REFERRAL_SHAPE = /^[A-Z]{4,5}\d{4}$/;
const NOT_VALID = "Ese código no es válido.";
const EMPTY_CODE = "Escribe un código.";

function sameCode(left: string, right: string): boolean {
  return left.trim().toUpperCase() === right.trim().toUpperCase();
}

export function discountProbeOrder(raw: string): DiscountKind[] {
  const code = raw.trim().toUpperCase();
  if (code.startsWith(GIFT_PREFIX)) return ["gift", "promo", "referral"];
  if (REFERRAL_SHAPE.test(code)) return ["referral", "promo", "gift"];
  return ["promo", "referral", "gift"];
}

/** Same lookups the checkout quote and the order API already use. */
export function resolveDiscountInput(
  input: DiscountFields & { phone?: string | null },
  sources: DiscountSources,
): ResolvedDiscounts {
  const promoCode = input.promoCode?.trim() || null;
  const promo = promoCode ? (sources.promos.find((item) => sameCode(item.code, promoCode)) ?? null) : null;
  const referralCode = input.referralCode?.trim() || "";
  const referral = referralCode ? (sources.referrals.find((item) => sameCode(item.code, referralCode)) ?? null) : null;
  let referralError: string | null = null;
  let referralDiscountCents: number | null = null;
  if (referralCode) {
    if (!referral) referralError = "Ese código de amigo no existe.";
    else if (input.phone && referral.ownerPhone === input.phone) referralError = "No puedes usar tu propio código.";
    else referralDiscountCents = referral.friendDiscountCents || REFERRAL_FRIEND_CENTS;
  }
  const giftCode = input.giftCardCode?.trim() || "";
  const giftCard = giftCode ? (sources.giftCards.find((item) => sameCode(item.code, giftCode)) ?? null) : null;
  let giftCardError: string | null = null;
  let giftCardBalanceCents: number | null = null;
  if (giftCode) {
    if (!giftCard || giftCard.status !== "active" || giftCard.balanceCents <= 0) giftCardError = "Esa tarjeta de regalo no tiene saldo.";
    else giftCardBalanceCents = giftCard.balanceCents;
  }
  return { promo, promoCode, referral, referralDiscountCents, referralError, giftCard, giftCardBalanceCents, giftCardError };
}

function promoMessage(promo: Promo): string {
  const detail = promo.kind === "percent" ? `${promo.value}%` : formatSoles(promo.value);
  return `Código promocional aplicado: ${detail}`;
}

export function giftAppliedLabel(balanceCents: number, appliedCents?: number | null): string {
  const cents = appliedCents != null && appliedCents > 0 ? appliedCents : balanceCents;
  return `Tarjeta de regalo aplicada: ${formatSoles(cents)}`;
}

function classifyKind(
  kind: DiscountKind,
  raw: string,
  sources: DiscountSources,
  phone: string | null,
  now?: Date,
): ClassifiedCode | null {
  const code = raw.trim();
  if (kind === "promo") {
    const resolved = resolveDiscountInput({ promoCode: code, phone }, sources);
    if (!resolved.promo) return null;
    const priced = quote({
      items: [{ unitPriceCents: 10000 }],
      promo: resolved.promo,
      promoCode: resolved.promoCode,
      now,
    });
    if (priced.promoError) return { ok: false, error: priced.promoError };
    return { ok: true, kind: "promo", code: resolved.promo.code, message: promoMessage(resolved.promo) };
  }
  if (kind === "referral") {
    const resolved = resolveDiscountInput({ referralCode: code, phone }, sources);
    if (!resolved.referral) return null;
    if (resolved.referralError) return { ok: false, error: resolved.referralError };
    return { ok: true, kind: "referral", code: resolved.referral.code, message: "Código de amigo aplicado" };
  }
  const resolved = resolveDiscountInput({ giftCardCode: code, phone }, sources);
  if (!resolved.giftCard) return null;
  if (resolved.giftCardError || resolved.giftCardBalanceCents == null) {
    return { ok: false, error: resolved.giftCardError || "Esa tarjeta de regalo no tiene saldo." };
  }
  return {
    ok: true,
    kind: "gift",
    code: resolved.giftCard.code,
    message: giftAppliedLabel(resolved.giftCardBalanceCents),
  };
}

function missMessage(kind: DiscountKind): string {
  if (kind === "gift") return "Esa tarjeta de regalo no tiene saldo.";
  if (kind === "referral") return "Ese código de amigo no existe.";
  return NOT_VALID;
}

export function classifyDiscountCode(
  raw: string,
  sources: DiscountSources,
  options?: { phone?: string | null; now?: Date },
): ClassifiedCode {
  const code = raw.trim();
  if (!code) return { ok: false, error: EMPTY_CODE };
  const phone = options?.phone ? normalizePhone(options.phone) : null;
  const order = discountProbeOrder(code);
  for (const kind of order) {
    const result = classifyKind(kind, code, sources, phone, options?.now);
    if (result) return result;
  }
  if (order[0] !== "promo") return { ok: false, error: missMessage(order[0]) };
  return { ok: false, error: NOT_VALID };
}

export function applyClassifiedCode(current: AppliedDiscountFields, result: Extract<ClassifiedCode, { ok: true }>): AppliedDiscountFields {
  if (result.kind === "promo") return { ...current, promoCode: result.code };
  if (result.kind === "referral") return { ...current, referralCode: result.code };
  return { ...current, giftCardCode: result.code };
}

export function clearDiscountKind(current: AppliedDiscountFields, kind: DiscountKind): AppliedDiscountFields {
  if (kind === "promo") return { ...current, promoCode: "" };
  if (kind === "referral") return { ...current, referralCode: "" };
  return { ...current, giftCardCode: "" };
}

export function appliedDiscountChips(current: AppliedDiscountFields): AppliedDiscountChip[] {
  const chips: AppliedDiscountChip[] = [];
  const promo = current.promoCode.trim();
  const referral = current.referralCode.trim();
  const gift = current.giftCardCode.trim();
  if (promo) chips.push({ kind: "promo", code: promo, label: `Promo ${promo}` });
  if (referral) chips.push({ kind: "referral", code: referral, label: `Amigo ${referral}` });
  if (gift) chips.push({ kind: "gift", code: gift, label: `Regalo ${gift}` });
  return chips;
}
