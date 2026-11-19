import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { ADMIN_UNAUTHORIZED, adminSessionFromClient, decideAdminGate } from "../src/lib/admin-access";
import { signUpCustomer } from "../src/lib/customer-auth";
import { chargedGiftWrap, hidePricesForOrder } from "../src/lib/gift-wrap";
import { giftWrapBadge, orderMoneyLines, paymentMethodLabel, paymentStatusLabel } from "../src/lib/order-admin";
import { createLocalRepo } from "../src/lib/repo-local";
import { evaluateOrder } from "../src/lib/server-order";
import { trackingEmail, trackingWarning } from "../src/lib/tracking-mail";
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
    taxIdSkipped: true,
    giftWrap: true,
    giftPrinted: false,
    hidePrices: false,
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

const cardItem: CheckoutInput["items"][number] = {
  frameId: "card",
  photoId: "p",
  crop: { imageWidth: 2000, imageHeight: 2000, x: 0, y: 0, width: 1500, height: 2000 },
  orientation: "portrait",
  dpi: 300,
  resolutionStatus: "good",
  card: {
    sizeId: "a4",
    quantity: 1,
    envelopeColor: "blanco",
    templateId: "noche",
    frontMessage: null,
    insideMessage: null,
    photos: {},
    bleed: false,
  },
};

describe("admin gate", () => {
  it("rejects a signed-in customer who is not in admin_users", async () => {
    expect(decideAdminGate({ userId: null, isAdmin: false })).toEqual({ ok: false, message: null });
    expect(decideAdminGate({ userId: "cust", isAdmin: false })).toEqual({ ok: false, message: ADMIN_UNAUTHORIZED });
    expect(decideAdminGate({ userId: "cust", isAdmin: false, lookupError: true }).message).toBe(ADMIN_UNAUTHORIZED);
    expect(decideAdminGate({ userId: "admin", isAdmin: true })).toEqual({ ok: true });

    const gate = await adminSessionFromClient({
      auth: { getSession: async () => ({ data: { session: { user: { id: "cust-1" } } } }) },
      from: (table) => ({
        select: () => ({
          eq: (column, value) => ({
            maybeSingle: async () => {
              expect(table).toBe("admin_users");
              expect(column).toBe("user_id");
              expect(value).toBe("cust-1");
              return { data: null, error: null };
            },
          }),
        }),
      }),
    });
    expect(gate).toEqual({ ok: false, message: ADMIN_UNAUTHORIZED });
  });
});

describe("admin order breakdown", () => {
  it("formats every line in soles, including zeros", () => {
    const lines = orderMoneyLines({
      subtotalCents: 10900,
      frameDiscountCents: 0,
      frameDiscountLabel: null,
      promoCode: null,
      promoDiscountCents: 0,
      referralCode: null,
      referralDiscountCents: 0,
      creditAppliedCents: 0,
      giftCardCode: null,
      giftCardAppliedCents: 0,
      giftNoteCents: 0,
      giftWrapCents: 1000,
      totalCents: 11900,
    });
    expect(lines.map((line) => `${line.label} ${line.text}`)).toEqual([
      "Subtotal S/ 109.00",
      "Descuentos S/ 0.00",
      "Tarjeta de regalo S/ 0.00",
      "Nota de regalo S/ 0.00",
      "Envoltorio S/ 10.00",
      "Envío S/ 0.00",
      "Total S/ 119.00",
    ]);
    expect(paymentStatusLabel("approved")).toBe("Pagado");
    expect(paymentStatusLabel("pending")).toBe("Pendiente");
    expect(paymentStatusLabel("rejected")).toBe("Fallido");
    expect(paymentMethodLabel("yape")).toBe("Yape");
    expect(paymentMethodLabel("card")).toBe("Tarjeta");
    expect(paymentMethodLabel("gift_card")).toBe("Tarjeta de regalo");
    expect(giftWrapBadge("Envoltorio de Navidad")).toBe("Envolver para regalo · Envoltorio de Navidad");
  });
});

describe("gift wrap hides prices and is not stored on card-only orders", () => {
  it("evaluates wrap only when a frame is in the order", () => {
    expect(chargedGiftWrap({ giftWrap: true, items: [{ card: { sizeId: "a4" } }] })).toBe(false);
    expect(chargedGiftWrap({ giftWrap: true, items: [{}] })).toBe(true);
    expect(hidePricesForOrder(false, true)).toBe(true);
    const wrapped = evaluateOrder(draft(), { promos: [], stock: {}, enforceStock: false });
    expect(wrapped.giftWrap).toBe(true);
    expect(wrapped.hidePrices).toBe(true);
    expect(wrapped.priced?.giftWrapCents).toBe(1000);
    const cards = evaluateOrder(draft({ items: [cardItem], giftWrap: true, hidePrices: false }), { promos: [], stock: {}, enforceStock: false });
    expect(cards.giftWrap).toBe(false);
    expect(cards.hidePrices).toBe(false);
    expect(cards.priced?.giftWrapCents).toBe(0);
    const shop = readFileSync("api/shop.mjs", "utf8");
    expect(shop).toContain("gift_wrap: Boolean(evaluated.giftWrap)");
    expect(shop).toContain("hide_prices: Boolean(evaluated.hidePrices)");
    expect(shop).not.toContain("gift_wrap: Boolean(req.body.giftWrap)");
  });

  it("stores the evaluated wrap on a local order", async () => {
    const repo = createLocalRepo();
    await repo.init();
    await signUpCustomer("ana@ejemplo.com", "clave1234");
    const wrapped = await repo.placeOrder(draft());
    expect(wrapped.giftWrap).toBe(true);
    expect(wrapped.hidePrices).toBe(true);
    expect(wrapped.giftWrapCents).toBe(1000);
    const onlyCard = await repo.placeOrder(draft({ items: [cardItem], giftWrap: true, hidePrices: false }));
    expect(onlyCard.giftWrap).toBe(false);
    expect(onlyCard.hidePrices).toBe(false);
    expect(onlyCard.giftWrapCents).toBe(0);
  });
});

describe("tracking email", () => {
  it("writes a Mi Fotito message with the public tracking link", () => {
    const mail = trackingEmail({ number: "MF-26-1004", publicToken: "abc", trackingNumber: "OLVA-1", customerName: "Ana Quispe" });
    expect(mail.subject).toBe("Tu pedido va en camino");
    expect(mail.text).toContain("MF-26-1004");
    expect(mail.text).toContain("OLVA-1");
    expect(mail.text).toContain("https://mifotito.com/pedido/abc");
    expect(mail.html).toContain("MI FOTITO");
    expect(trackingWarning({ email: "", smtpReady: false, sent: false })).toMatch(/no tiene correo/);
    expect(trackingWarning({ email: "ana@ejemplo.com", smtpReady: false, sent: false })).toMatch(/SMTP_HOST/);
    expect(trackingWarning({ email: "ana@ejemplo.com", smtpReady: true, sent: false, reason: "rechazado" })).toMatch(/rechazado/);
    expect(trackingWarning({ email: "ana@ejemplo.com", smtpReady: true, sent: true })).toBeNull();
  });

  it("emails the customer from the local admin and still saves the guide without an address", async () => {
    const repo = createLocalRepo();
    await repo.init();
    await signUpCustomer("ana2@ejemplo.com", "clave1234");
    const order = await repo.placeOrder(draft({ email: "ana2@ejemplo.com", phone: "987654322" }));
    const sent = await repo.setTracking(order.id, "OLVA-99");
    expect(sent.status).toBe("shipped");
    expect(sent.trackingNumber).toBe("OLVA-99");
    expect(sent.emailWarning).toBeFalsy();
    const notes = await repo.listNotifications(order.id);
    expect(notes.map((note) => note.channel)).toEqual(["email"]);
    expect(notes[0]?.to).toBe("ana2@ejemplo.com");
    expect(notes[0]?.body).toContain("https://mifotito.com/pedido/");
    order.email = null;
    const quiet = await repo.setTracking(order.id, "OLVA-100");
    expect(quiet.trackingNumber).toBe("OLVA-100");
    expect(quiet.emailWarning).toMatch(/no tiene correo/);
  });
});
