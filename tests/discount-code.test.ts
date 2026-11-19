import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import commerce from "../data/commerce.json";
import {
  appliedDiscountChips,
  applyClassifiedCode,
  classifyDiscountCode,
  clearDiscountKind,
  discountProbeOrder,
  giftAppliedLabel,
  type AppliedDiscountFields,
  type ClassifiedCode,
  type DiscountSources,
} from "../src/lib/discount-code";
import { createLocalRepo } from "../src/lib/repo-local";
import { evaluateOrder } from "../src/lib/server-order";
import type { CheckoutInput, GiftCard, Promo, Referral } from "../src/lib/types";

const memory = new Map<string, string>();

vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => memory.set(key, value),
  removeItem: (key: string) => memory.delete(key),
});

const now = new Date("2026-12-10T15:00:00-05:00");

const sources: DiscountSources = {
  promos: commerce.promos as Promo[],
  referrals: commerce.referrals as Referral[],
  giftCards: commerce.giftCards as GiftCard[],
};

const empty: AppliedDiscountFields = { promoCode: "", referralCode: "", giftCardCode: "" };

function mustApply(result: ClassifiedCode) {
  if (!result.ok) throw new Error(result.error);
  return result;
}

function draft(extra: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    items: [{
      frameId: "thin-black-15",
      photoId: "p",
      crop: { imageWidth: 2000, imageHeight: 2000, x: 0, y: 0, width: 1500, height: 2000 },
      orientation: "portrait",
      dpi: 300,
      resolutionStatus: "good",
    }],
    customerName: "Lucía Pérez",
    phone: "987654321",
    email: "lucia@ejemplo.com",
    password: "clave1234",
    taxIdSkipped: true,
    giftWrap: false,
    addressLine: "Calle 1",
    district: "Miraflores",
    city: "Lima",
    department: "Lima",
    province: "Lima",
    useCredit: false,
    paymentMethod: "yape",
    ackLowRes: false,
    ...extra,
  };
}

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

describe("discount code detection", () => {
  it("tries a gift card first when the code uses the REGALO- prefix", () => {
    expect(discountProbeOrder("regalo-ab12cd34")).toEqual(["gift", "promo", "referral"]);
    const card: GiftCard = {
      ...sources.giftCards[0],
      code: "REGALO-AB12CD34",
      balanceCents: 8000,
      initialCents: 8000,
    };
    const mixed: DiscountSources = {
      ...sources,
      promos: [{ code: "REGALO-AB12CD34", kind: "fixed", value: 1000, usedCount: 0, active: true }],
      giftCards: [card],
    };
    expect(classifyDiscountCode("regalo-ab12cd34", mixed, { now })).toEqual({
      ok: true,
      kind: "gift",
      code: "REGALO-AB12CD34",
      message: "Tarjeta de regalo aplicada: S/ 80.00",
    });
  });

  it("tries a referral first when the code matches an amigo code, then the other catalogs", () => {
    expect(discountProbeOrder("AMIGO1500")).toEqual(["referral", "promo", "gift"]);
    expect(classifyDiscountCode("amigo1500", sources, { now, phone: "987654321" })).toEqual({
      ok: true,
      kind: "referral",
      code: "AMIGO1500",
      message: "Código de amigo aplicado",
    });
    const promoShaped: DiscountSources = {
      ...sources,
      referrals: [],
      promos: [{ code: "MARCO2026", kind: "fixed", value: 2000, usedCount: 0, active: true }],
    };
    expect(classifyDiscountCode("marco2026", promoShaped, { now }).ok && classifyDiscountCode("marco2026", promoShaped, { now })).toMatchObject({
      ok: true,
      kind: "promo",
      code: "MARCO2026",
    });
  });

  it("queries promo, then amigo, then regalo when the code has no known shape", () => {
    expect(discountProbeOrder("HOLANAVIDAD")).toEqual(["promo", "referral", "gift"]);
    expect(classifyDiscountCode("  navidad10 ", sources, { now })).toMatchObject({
      ok: true,
      kind: "promo",
      code: "NAVIDAD10",
      message: "Código promocional aplicado: 10%",
    });
    expect(classifyDiscountCode("holanavidad", sources, { now })).toEqual({
      ok: true,
      kind: "gift",
      code: "HOLANAVIDAD",
      message: "Tarjeta de regalo aplicada: S/ 50.00",
    });
    expect(classifyDiscountCode("MARCO20", sources, { now })).toMatchObject({
      ok: true,
      kind: "promo",
      message: "Código promocional aplicado: S/ 20.00",
    });
  });

  it("keeps each validator's rejection and says when nothing matches", () => {
    expect(classifyDiscountCode("   ", sources, { now })).toEqual({ ok: false, error: "Escribe un código." });
    expect(classifyDiscountCode("NOPE", sources, { now })).toEqual({ ok: false, error: "Ese código no es válido." });
    expect(classifyDiscountCode("REGALO-DESCONOCIDO", sources, { now }).error).toMatch(/no tiene saldo/);
    expect(classifyDiscountCode("LUCI9999", sources, { now }).error).toMatch(/amigo no existe/);
    expect(classifyDiscountCode("NAVIDAD10", sources, { now: new Date("2026-12-26T00:00:00-05:00") }).error).toMatch(/venció/);
    expect(classifyDiscountCode("NAVIDAD10", { ...sources, promos: [{ ...sources.promos[0], active: false }] }, { now }).error).toMatch(/activo/);
    expect(classifyDiscountCode("NAVIDAD10", { ...sources, promos: [{ ...sources.promos[0], maxUses: 12, usedCount: 12 }] }, { now }).error).toMatch(/agotó/);
    expect(classifyDiscountCode("AMIGO1500", sources, { phone: "911111111", now }).error).toMatch(/propio código/);
    const emptyCard: GiftCard = { ...sources.giftCards[0], balanceCents: 0 };
    expect(classifyDiscountCode("HOLANAVIDAD", { ...sources, giftCards: [emptyCard] }, { now }).error).toMatch(/no tiene saldo/);
  });
});

describe("discount code application", () => {
  it("stacks a promo, an amigo code and a gift card, and can drop one", () => {
    const promo = mustApply(classifyDiscountCode("NAVIDAD10", sources, { now }));
    const amigo = mustApply(classifyDiscountCode("AMIGO1500", sources, { now, phone: "987654321" }));
    const gift = mustApply(classifyDiscountCode("HOLANAVIDAD", sources, { now }));
    const stacked = applyClassifiedCode(applyClassifiedCode(applyClassifiedCode(empty, promo), amigo), gift);
    expect(stacked).toEqual({ promoCode: "NAVIDAD10", referralCode: "AMIGO1500", giftCardCode: "HOLANAVIDAD" });
    expect(giftAppliedLabel(5000, 3810)).toBe("Tarjeta de regalo aplicada: S/ 38.10");
    expect(giftAppliedLabel(5000)).toBe("Tarjeta de regalo aplicada: S/ 50.00");
    expect(appliedDiscountChips(stacked).map((chip) => chip.label)).toEqual(["Promo NAVIDAD10", "Amigo AMIGO1500", "Regalo HOLANAVIDAD"]);

    const replaced = applyClassifiedCode(stacked, mustApply(classifyDiscountCode("MARCO20", sources, { now })));
    expect(replaced.promoCode).toBe("MARCO20");
    expect(replaced.referralCode).toBe("AMIGO1500");
    expect(clearDiscountKind(replaced, "gift")).toEqual({ promoCode: "MARCO20", referralCode: "AMIGO1500", giftCardCode: "" });

    const evaluated = evaluateOrder(draft(stacked), {
      promos: sources.promos,
      referrals: sources.referrals,
      giftCards: sources.giftCards,
      stock: {},
      enforceStock: false,
    });
    expect(evaluated).not.toHaveProperty("error");
    if ("priced" in evaluated) {
      expect(evaluated.priced.promoDiscountCents).toBe(590);
      expect(evaluated.priced.referralDiscountCents).toBe(1500);
      expect(evaluated.priced.giftCardAppliedCents).toBe(3810);
      expect(evaluated.priced.totalCents).toBe(0);
    }
  });

  it("still rejects an unknown promo on the order payload", () => {
    const evaluated = evaluateOrder(draft({ promoCode: "NOPE" }), { promos: sources.promos, stock: {}, enforceStock: false });
    expect(evaluated).toEqual({ error: "Ese código no existe." });
  });

  it("saves the three payload fields when the codes are applied together", async () => {
    const repo = createLocalRepo();
    await repo.init();
    const order = await repo.placeOrder(draft({
      email: "codigos@ejemplo.com",
      promoCode: "navidad10",
      referralCode: "amigo1500",
      giftCardCode: "holanavidad",
    }));
    expect(order.promoCode).toBe("NAVIDAD10");
    expect(order.promoDiscountCents).toBe(590);
    expect(order.referralCode).toBe("AMIGO1500");
    expect(order.referralDiscountCents).toBe(1500);
    expect(order.giftCardCode).toBe("HOLANAVIDAD");
    expect(order.giftCardAppliedCents).toBe(3810);
    expect(order.totalCents).toBe(0);
  });

  it("shows one code field on checkout for guests and signed-in buyers", () => {
    const labels = ['label="Código promo"', 'label="Código de amigo"', 'label="Tarjeta de regalo"'];
    const hits = files("src/app").flatMap((path) => {
      const text = readFileSync(path, "utf8");
      return labels.filter((label) => text.includes(label)).map((label) => `${path}: ${label}`);
    });
    expect(hits).toEqual([]);
    const checkout = readFileSync("src/app/checkout.tsx", "utf8");
    const field = readFileSync("src/components/DiscountCodeField.tsx", "utf8");
    expect(checkout).toContain("DiscountCodeField");
    expect(checkout).toContain("promoCode:");
    expect(checkout).toContain("referralCode:");
    expect(checkout).toContain("giftCardCode:");
    expect(field).toContain("¿Tienes un código?");
    expect(field).toContain("Código promocional, de amigo o de regalo");
    expect(field).toContain("Aplicar");
    expect(readFileSync("src/app/carrito.tsx", "utf8")).not.toContain("Código promo");
  });
});
