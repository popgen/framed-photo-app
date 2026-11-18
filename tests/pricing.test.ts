import { describe, expect, it } from "vitest";
import { quote, type PromoRule } from "../src/lib/pricing";

const basic = { unitPriceCents: 5900 };
const wall = { unitPriceCents: 10900 };
const premium = { unitPriceCents: 12900 };

const navidad: PromoRule = {
  code: "NAVIDAD10",
  kind: "percent",
  value: 10,
  expiresAt: "2026-12-25T23:59:59-05:00",
  maxUses: 500,
  usedCount: 12,
  active: true,
};

const now = new Date("2026-12-10T15:00:00-05:00");

describe("pricing", () => {
  it("charges one basic frame at S/ 59", () => {
    const result = quote({ items: [basic], now });
    expect(result.subtotalCents).toBe(5900);
    expect(result.frameDiscountCents).toBe(0);
    expect(result.totalCents).toBe(5900);
  });

  it("takes 20% off the cheaper frame when there are two", () => {
    const result = quote({ items: [wall, basic], now });
    expect(result.subtotalCents).toBe(16800);
    expect(result.frameDiscountCents).toBe(1180);
    expect(result.frameDiscountLabel).toBe("Segundo marco al 20%");
    expect(result.totalCents).toBe(15620);
  });

  it("applies the 15% set discount from the third frame on, instead of stacking the second-frame deal", () => {
    const result = quote({ items: [basic, basic, basic], now });
    expect(result.subtotalCents).toBe(17700);
    expect(result.frameDiscountCents).toBe(2655);
    expect(result.frameDiscountLabel).toBe("Set de 3 o más al 15%");
    expect(result.totalCents).toBe(15045);
  });

  it("adds gift wrap at S/ 10 and does not discount it", () => {
    const result = quote({ items: [basic], giftWrap: true, now });
    expect(result.giftWrapCents).toBe(1000);
    expect(result.totalCents).toBe(6900);
  });

  it("applies a percent promo after the set discount, with half-up rounding", () => {
    const result = quote({ items: [basic, basic, basic], promo: navidad, promoCode: "navidad10", now });
    expect(result.promoDiscountCents).toBe(1505);
    expect(result.totalCents).toBe(15045 - 1505);
  });

  it("caps a fixed promo at the merchandise total", () => {
    const promo: PromoRule = { code: "MARCO20", kind: "fixed", value: 2000, usedCount: 0, active: true, maxUses: 10 };
    expect(quote({ items: [basic], promo, promoCode: "MARCO20", now }).totalCents).toBe(3900);
    const huge: PromoRule = { ...promo, value: 100000 };
    expect(quote({ items: [basic], promo: huge, promoCode: "MARCO20", now }).totalCents).toBe(0);
  });

  it("rejects expired, inactive, exhausted, and unknown promos", () => {
    expect(quote({ items: [basic], promo: { ...navidad, expiresAt: "2026-12-01T00:00:00-05:00" }, promoCode: "NAVIDAD10", now }).promoError).toMatch(/venció/);
    expect(quote({ items: [basic], promo: { ...navidad, active: false }, promoCode: "NAVIDAD10", now }).promoError).toMatch(/activo/);
    expect(quote({ items: [basic], promo: { ...navidad, maxUses: 12, usedCount: 12 }, promoCode: "NAVIDAD10", now }).promoError).toMatch(/agotó/);
    expect(quote({ items: [basic], promo: null, promoCode: "NOPE", now }).promoError).toMatch(/no existe/);
  });

  it("stacks referral, credit, and gift card without going below zero", () => {
    const result = quote({
      items: [premium],
      giftWrap: true,
      referralDiscountCents: 1500,
      useCredit: true,
      creditAvailableCents: 1500,
      giftCardBalanceCents: 5000,
      now,
    });
    expect(result.referralDiscountCents).toBe(1500);
    expect(result.creditAppliedCents).toBe(1500);
    expect(result.giftCardAppliedCents).toBe(5000);
    expect(result.totalCents).toBe(12900 - 1500 + 1000 - 1500 - 5000);
  });

  it("lets a gift card cover the whole order", () => {
    const result = quote({ items: [basic], giftCardBalanceCents: 10000, now });
    expect(result.giftCardAppliedCents).toBe(5900);
    expect(result.totalCents).toBe(0);
  });
});
