import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { checkoutPayMethodForSubmit, checkoutPayOptions, resolveCheckoutPayMethod } from "../src/lib/checkout-payment";
import { DONATION_CENTS, DONATION_MP_TITLE, acceptedDonationCents, donationCheckboxA11y, donationCheckboxLabel, donationSummaryText, donationToggleKey } from "../src/lib/donation";
import { buildMercadoPagoPreference } from "../src/lib/mercadopago";
import { quote } from "../src/lib/pricing";
import { createLocalRepo } from "../src/lib/repo-local";
import { evaluateOrder } from "../src/lib/server-order";
import { TEST_PRODUCT_CENTS, testCartItem, testProductEnabled } from "../src/lib/test-product";
import type { CheckoutInput } from "../src/lib/types";

const memory = new Map<string, string>();

vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => memory.set(key, value),
  removeItem: (key: string) => memory.delete(key),
});

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
    customerName: "Ana Quispe",
    phone: "987654321",
    email: "ana@ejemplo.com",
    password: "clave1234",
    taxIdSkipped: true,
    giftWrap: false,
    addressLine: "Calle 1",
    district: "Miraflores",
    city: "Lima",
    department: "Lima",
    province: "Lima",
    useCredit: false,
    paymentMethod: "card",
    ackLowRes: false,
    ...extra,
  };
}

describe("checkout payment options", () => {
  it("lists Izipay first and Mercado Pago, never Yape or Plin", () => {
    expect(checkoutPayOptions(false).map((item) => item.id)).toEqual(["card"]);
    expect(checkoutPayOptions(true).map((item) => `${item.label} (${item.hint})`)).toEqual([
      "Izipay (tarjeta de crédito o débito)",
      "Mercado Pago (Yape, cuotas, saldo o PagoEfectivo)",
    ]);
    const checkout = readFileSync("src/app/checkout.tsx", "utf8");
    expect(checkout).toContain("checkoutPayOptions");
    expect(checkout).not.toMatch(/label: "Yape"|label: "Plin"|label: "Tarjeta"/);
    expect(checkout).toContain("accessibilityLabel={item.label}");
    expect(checkout).toContain("IZIPAY_LOGO");
    expect(checkout).toContain("MERCADO_PAGO_LOGO");
  });

  it("sends yape and plin back to the default and never submits them", () => {
    expect(resolveCheckoutPayMethod("yape", true)).toBe("mercadopago");
    expect(resolveCheckoutPayMethod("plin", true)).toBe("mercadopago");
    expect(resolveCheckoutPayMethod("yape", false)).toBe("card");
    expect(resolveCheckoutPayMethod("plin", false)).toBe("card");
    expect(resolveCheckoutPayMethod("card", true)).toBe("card");
    expect(resolveCheckoutPayMethod(undefined, true)).toBe("mercadopago");
    expect(resolveCheckoutPayMethod("mercadopago", false)).toBe("card");
    expect(checkoutPayMethodForSubmit(null, true)).toBe("mercadopago");
    expect(checkoutPayMethodForSubmit("card", true)).toBe("card");
    expect(checkoutPayMethodForSubmit("mercadopago", false)).toBe("card");
  });
});

describe("donation", () => {
  it("adds S/ 5 after credits and refuses any other amount", () => {
    expect(donationCheckboxLabel()).toBe("Agregar S/ 5.00 de donación para Comunidades de la Selva");
    expect(donationCheckboxA11y(false)).toMatchObject({
      accessibilityRole: "checkbox",
      accessibilityLabel: "Agregar S/ 5.00 de donación para Comunidades de la Selva",
      accessibilityState: { checked: false },
      "aria-checked": false,
    });
    expect(donationCheckboxA11y(true)["aria-checked"]).toBe(true);
    expect(donationCheckboxA11y(true).accessibilityState.checked).toBe(true);
    expect(donationToggleKey(" ")).toBe(true);
    expect(donationToggleKey("Spacebar")).toBe(true);
    expect(donationToggleKey("Enter")).toBe(false);
    const checkout = readFileSync("src/app/checkout.tsx", "utf8");
    expect(checkout).toContain("donationCheckboxA11y(form.donation)");
    expect(checkout).toContain("donationToggleKey");
    expect(donationSummaryText()).toBe("Donación para Comunidades de la Selva — S/ 5.00");
    expect(acceptedDonationCents(undefined)).toBe(0);
    expect(acceptedDonationCents(500)).toBe(500);
    expect(acceptedDonationCents(100)).toBeNull();
    const plain = quote({ items: [{ unitPriceCents: 5900 }] });
    expect(plain.donationCents).toBe(0);
    expect(plain.totalCents).toBe(5900);
    const withDonation = quote({ items: [{ unitPriceCents: 5900 }], donationCents: DONATION_CENTS });
    expect(withDonation.totalCents).toBe(6400);
    const covered = quote({
      items: [{ unitPriceCents: 5900 }],
      useCredit: true,
      creditAvailableCents: 100000,
      donationCents: DONATION_CENTS,
    });
    expect(covered.creditAppliedCents).toBe(5900);
    expect(covered.donationCents).toBe(500);
    expect(covered.totalCents).toBe(500);
    const rejected = evaluateOrder(draft({ donationCents: 100 }), { promos: [], stock: {}, enforceStock: false });
    expect(rejected.error).toMatch(/donación/i);
  });

  it("keeps an empty cart invalid", () => {
    const empty = evaluateOrder(draft({ items: [], donationCents: DONATION_CENTS }), { promos: [], stock: {}, enforceStock: false });
    expect(empty.error).toBe("Tu carrito está vacío.");
    const none = evaluateOrder(draft({ items: [] }), { promos: [], stock: {}, enforceStock: false });
    expect(none.error).toBe("Tu carrito está vacío.");
  });

  it("sends the donation as its own Mercado Pago item", () => {
    const body = buildMercadoPagoPreference({
      amountCents: 6400,
      orderId: "ord_1",
      description: "Pedido MF-1",
      publicToken: "tok",
      donationCents: DONATION_CENTS,
    });
    expect(body.items).toEqual([
      { title: "Pedido MF-1", quantity: 1, currency_id: "PEN", unit_price: 59 },
      { title: DONATION_MP_TITLE, quantity: 1, currency_id: "PEN", unit_price: 5 },
    ]);
    expect(DONATION_MP_TITLE).toBe("Donación Comunidades de la Selva");
  });
});

describe("test product", () => {
  it("is on unless the flag says otherwise and stays out of the public catalog", () => {
    expect(testProductEnabled({})).toBe(true);
    expect(testProductEnabled({ TEST_PRODUCT_ENABLED: "false" })).toBe(false);
    expect(readFileSync("data/frames.json", "utf8")).not.toContain("producto-prueba");
    expect(readFileSync("src/lib/seo.ts", "utf8")).toContain('"/prueba"');
    expect(readFileSync("public/robots.txt", "utf8")).toContain("Disallow: /prueba");
    expect(readFileSync("src/app/prueba.tsx", "utf8")).toContain("noindex");
    expect(readFileSync("src/app/index.tsx", "utf8")).not.toContain("Producto de prueba");
  });

  it("charges exactly S/ 5.00, or S/ 10.00 with the donation, and ignores discounts", async () => {
    const ctx = { promos: [], stock: {}, enforceStock: false, credits: { "51987654321": 5000 } };
    const alone = evaluateOrder(draft({
      items: [testCartItem()],
      promoCode: "NAVIDAD",
      useCredit: true,
      giftWrap: true,
      donationCents: 0,
    }), ctx);
    expect(alone.error).toBeUndefined();
    expect(alone.priced?.totalCents).toBe(TEST_PRODUCT_CENTS);
    expect(alone.priced?.donationCents).toBe(0);
    expect(alone.priced?.creditAppliedCents).toBe(0);
    expect(alone.priced?.giftWrapCents).toBe(0);
    expect(alone.etaLabel).toBe("");

    const both = evaluateOrder(draft({ items: [testCartItem()], donationCents: DONATION_CENTS, useCredit: true }), ctx);
    expect(both.priced?.totalCents).toBe(1000);
    expect(both.priced?.donationCents).toBe(500);

    const repo = createLocalRepo();
    await repo.init();
    await expect(repo.placeOrder(draft({ items: [] }))).rejects.toThrow(/vacío/);
    const order = await repo.placeOrder(draft({ items: [testCartItem()], donationCents: DONATION_CENTS, paymentMethod: "card" }));
    expect(order.totalCents).toBe(1000);
    expect(order.donationCents).toBe(500);
    expect(order.shippingCents).toBe(0);
    expect(order.items[0]?.testProduct).toBe(true);
    expect(order.paymentMethod).toBe("card");
  });
});
