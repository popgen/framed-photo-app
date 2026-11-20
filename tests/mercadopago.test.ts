import { afterEach, describe, expect, it, vi } from "vitest";
import { IZIPAY_CREATE_URL } from "../src/lib/izipay";
import {
  buildMercadoPagoPreference,
  centsToUnitPrice,
  mercadoPagoConfirmationState,
  mercadoPagoManifest,
  MERCADOPAGO_NOTIFICATION_URL,
  MERCADOPAGO_PREFERENCE_URL,
  readMercadoPagoPayment,
  solesToCents,
  verifyMercadoPagoSignature,
} from "../src/lib/mercadopago";
import {
  completeMercadoPagoNotification,
  configuredSite,
  mercadoPagoOffered,
  PAYMENT_AMOUNT,
  PAYMENT_BAD_SIGNATURE,
  PAYMENTS_NOT_CONFIGURED,
  type PayableOrder,
  type PaymentStore,
} from "../src/lib/payments";

const secret = "mp-webhook-secret";
const token = "APP_USR-test-token";

const order: PayableOrder = {
  id: "ord_1",
  totalCents: 5900,
  paymentStatus: "pending",
  publicToken: "tokenpublico",
  email: "ana@ejemplo.com",
  customerName: "Ana Flores",
  number: "MF-26-2001",
};

function capture() {
  const sent: { status?: number; body?: unknown } = {};
  const res = {
    status(code: number) {
      sent.status = code;
      return res;
    },
    json(data: unknown) {
      sent.body = data;
      return res;
    },
  };
  return { sent, res };
}

function memoryStore(initial: PayableOrder = order) {
  let current = { ...initial };
  let applies = 0;
  let rejects = 0;
  let notices = 0;
  const store: PaymentStore = {
    async getOrder(id) {
      return id === current.id ? current : null;
    },
    async markPaidOnce(_id, payment) {
      if (current.paymentStatus === "approved") return { already: true, order: current };
      applies += 1;
      current = { ...current, paymentStatus: "approved", paymentRef: payment.ref } as PayableOrder;
      return { already: false, order: current };
    },
    async markRejectedOnce(_id, payment) {
      if (current.paymentStatus === "approved" || current.paymentStatus === "rejected") return { already: true, order: current };
      rejects += 1;
      current = { ...current, paymentStatus: "rejected", paymentRef: payment.ref } as PayableOrder;
      return { already: false, order: current };
    },
    async notifyPaid() {
      notices += 1;
    },
  };
  return { store, applies: () => applies, rejects: () => rejects, notices: () => notices, read: () => current };
}

async function hmacHex(keyText: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(keyText), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
  return [...sig].map((item) => item.toString(16).padStart(2, "0")).join("");
}

async function signed(dataId: string, requestId: string, ts: string) {
  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;
  const v1 = await hmacHex(secret, manifest);
  return { manifest, header: `ts=${ts},v1=${v1}` };
}

function paymentResource(overrides: Record<string, unknown> = {}) {
  return {
    id: 987654,
    status: "approved",
    transaction_amount: 59,
    currency_id: "PEN",
    external_reference: "ord_1",
    payment_type_id: "credit_card",
    payment_method_id: "visa",
    ...overrides,
  };
}

function fetchPayment(resource: Record<string, unknown>) {
  return vi.fn(async (url: string, init?: RequestInit) => ({
    ok: true,
    status: 200,
    url,
    init,
    json: async () => resource,
  }));
}

describe("Mercado Pago preference", () => {
  it("builds a Peru Checkout Pro preference without a customer surcharge", () => {
    const body = buildMercadoPagoPreference({
      amountCents: 5900,
      orderId: "ord_1",
      email: "ana@ejemplo.com",
      name: "Ana Flores",
      description: "Pedido MF-26-2001",
      publicToken: "token publico",
    });
    expect(centsToUnitPrice(5900)).toBe(59);
    expect(centsToUnitPrice(6999)).toBe(69.99);
    expect(solesToCents(19.99)).toBe(1999);
    expect(body.items).toEqual([{ title: "Pedido MF-26-2001", quantity: 1, currency_id: "PEN", unit_price: 59 }]);
    expect(body.statement_descriptor).toBe("MIFOTITO");
    expect(body.external_reference).toBe("ord_1");
    expect(body.auto_return).toBe("approved");
    expect(body.binary_mode).toBe(false);
    expect(body.notification_url).toBe("https://mifotito.com/api/payments/mercadopago-webhook");
    expect(body.back_urls).toEqual({
      success: "https://mifotito.com/confirmacion/token%20publico",
      pending: "https://mifotito.com/confirmacion/token%20publico",
      failure: "https://mifotito.com/checkout?pago=mercadopago&pedido=token%20publico",
    });
    const staged = buildMercadoPagoPreference({
      amountCents: 5900,
      orderId: "ord_1",
      description: "Pedido",
      publicToken: "token publico",
      site: configuredSite({ SITE_URL: "https://caja.ejemplo/" }),
    });
    expect(staged.auto_return).toBe("approved");
    expect(staged.back_urls).toEqual({
      success: "https://caja.ejemplo/confirmacion/token%20publico",
      pending: "https://caja.ejemplo/confirmacion/token%20publico",
      failure: "https://caja.ejemplo/checkout?pago=mercadopago&pedido=token%20publico",
    });
    expect(body.payment_methods).toEqual({ installments: 12, default_installments: 1 });
    expect(body).not.toHaveProperty("marketplace_fee");
    expect(JSON.stringify(body)).not.toContain("excluded_payment");
    const priced = buildMercadoPagoPreference({
      amountCents: 6900,
      orderId: "ord_2",
      description: "Pedido",
      publicToken: "tok",
    });
    expect((priced.items as { unit_price: number }[])[0].unit_price).toBe(69);
  });

  it("asks Mercado Pago for init_point and leaves card payments on Izipay", async () => {
    const { createPayment } = await import("../api/payments/create.mjs");
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => ({
      ok: true,
      status: 200,
      json: async () => (String(url).includes("mercadopago") ? { init_point: "https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=abc" } : { status: "SUCCESS", answer: { formToken: "form-1" } }),
      body: init?.body,
    }));
    const live = {
      PAYMENTS_MODE: "live",
      MERCADOPAGO_ACCESS_TOKEN: token,
      MERCADOPAGO_WEBHOOK_SECRET: secret,
      IZIPAY_COMMERCE_ID: "shop",
      IZIPAY_API_KEY: "secret",
      IZIPAY_PUBLIC_KEY: "public",
      IZIPAY_HMAC_KEY: "hmac",
      SITE_URL: "https://caja.ejemplo/",
    };
    const sent = capture();
    await createPayment(
      { method: "POST", body: { orderId: "ord_1", amountCents: 1, method: "mercadopago" } },
      sent.res,
      { env: live, fetchImpl: fetchMock, loadOrder: async () => order },
    );
    const raw = String(fetchMock.mock.calls[0][1]?.body);
    const preference = JSON.parse(raw);
    expect(fetchMock.mock.calls[0][0]).toBe(MERCADOPAGO_PREFERENCE_URL);
    expect(preference.external_reference).toBe("ord_1");
    expect(preference.items[0]).toMatchObject({ currency_id: "PEN", unit_price: 59 });
    expect(preference.notification_url).toBe(MERCADOPAGO_NOTIFICATION_URL);
    expect(preference.auto_return).toBe("approved");
    expect(preference.back_urls).toEqual({
      success: "https://caja.ejemplo/confirmacion/tokenpublico",
      pending: "https://caja.ejemplo/confirmacion/tokenpublico",
      failure: "https://caja.ejemplo/checkout?pago=mercadopago&pedido=tokenpublico",
    });
    expect(sent.sent).toMatchObject({ status: 200, body: { provider: "mercadopago", status: "pending", mock: false, checkoutUrl: "https://www.mercadopago.com.pe/checkout/v1/redirect?pref_id=abc" } });

    const card = capture();
    await createPayment(
      { method: "POST", body: { orderId: "ord_1", method: "card" } },
      card.res,
      { env: live, fetchImpl: fetchMock, loadOrder: async () => order },
    );
    expect(fetchMock.mock.calls[1][0]).toBe(IZIPAY_CREATE_URL);
    expect(card.sent.body).toMatchObject({ provider: "izipay", formToken: "form-1" });

    const plinFetch = vi.fn();
    const plin = capture();
    await createPayment(
      { method: "POST", body: { orderId: "ord_1", method: "plin" } },
      plin.res,
      { env: { ...live, PLIN_PHONE: "999888777" }, fetchImpl: plinFetch, loadOrder: async () => order },
    );
    expect(plinFetch).not.toHaveBeenCalled();
    expect(plin.sent.body).toMatchObject({ provider: "plin", instructions: "Plin al 999888777 y escribe el pedido ord_1." });
  });

  const keys = ["PAYMENTS_MODE", "MERCADOPAGO_ACCESS_TOKEN", "MERCADOPAGO_PUBLIC_KEY", "MERCADOPAGO_WEBHOOK_SECRET"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  afterEach(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
  });

  it("stays hidden unless live mode has the access token and the webhook secret", async () => {
    expect(mercadoPagoOffered({ PAYMENTS_MODE: "mock", MERCADOPAGO_ACCESS_TOKEN: token, MERCADOPAGO_WEBHOOK_SECRET: secret })).toBe(false);
    expect(mercadoPagoOffered({ PAYMENTS_MODE: "live", MERCADOPAGO_ACCESS_TOKEN: token })).toBe(false);
    expect(mercadoPagoOffered({ PAYMENTS_MODE: "live", MERCADOPAGO_PUBLIC_KEY: "pub", MERCADOPAGO_WEBHOOK_SECRET: secret })).toBe(false);
    expect(mercadoPagoOffered({ PAYMENTS_MODE: "live", MERCADOPAGO_ACCESS_TOKEN: token, MERCADOPAGO_WEBHOOK_SECRET: secret })).toBe(true);
    const { paymentMethods } = await import("../api/payments/methods.mjs");
    const hidden = capture();
    await paymentMethods({ method: "GET" }, hidden.res, { env: { PAYMENTS_MODE: "live", MERCADOPAGO_ACCESS_TOKEN: token } });
    expect(hidden.sent.body).toEqual({ mercadopago: false });
    const shown = capture();
    await paymentMethods({ method: "GET" }, shown.res, { env: { PAYMENTS_MODE: "live", MERCADOPAGO_ACCESS_TOKEN: token, MERCADOPAGO_WEBHOOK_SECRET: secret } });
    expect(shown.sent.body).toEqual({ mercadopago: true });
    const { createPayment } = await import("../api/payments/create.mjs");
    const refused = capture();
    const fetchMock = vi.fn();
    await createPayment(
      { method: "POST", body: { orderId: "ord_1", method: "mercadopago" } },
      refused.res,
      { env: { PAYMENTS_MODE: "mock", MERCADOPAGO_ACCESS_TOKEN: token, MERCADOPAGO_WEBHOOK_SECRET: secret }, fetchImpl: fetchMock, loadOrder: async () => order },
    );
    expect(refused.sent).toMatchObject({ status: 501, body: { error: PAYMENTS_NOT_CONFIGURED } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("Mercado Pago webhook", () => {
  it("verifies the x-signature manifest and rejects a tampered id", async () => {
    const { header, manifest } = await signed("AbC123", "req-1", "1700000000");
    expect(mercadoPagoManifest("AbC123", "req-1", "1700000000")).toBe(manifest);
    expect(await verifyMercadoPagoSignature({ xSignature: header, xRequestId: "req-1", dataId: "AbC123", secret })).toBe(true);
    expect(await verifyMercadoPagoSignature({ xSignature: header.toUpperCase(), xRequestId: "req-1", dataId: "AbC123", secret })).toBe(true);
    expect(await verifyMercadoPagoSignature({ xSignature: header, xRequestId: "req-1", dataId: "otro", secret })).toBe(false);
    expect(await verifyMercadoPagoSignature({ xSignature: header, xRequestId: "req-1", dataId: "AbC123", secret: "otra" })).toBe(false);
    expect(await verifyMercadoPagoSignature({ xSignature: "", xRequestId: "req-1", dataId: "AbC123", secret })).toBe(false);
    const blankRequest = `id:123;ts:1700000000;`;
    const blankHeader = `ts=1700000000,v1=${await hmacHex(secret, blankRequest)}`;
    expect(await verifyMercadoPagoSignature({ xSignature: blankHeader, xRequestId: "", dataId: "123", secret })).toBe(true);
  });

  it("marks the order paid once when the fetched payment matches", async () => {
    const { header } = await signed("987654", "req-1", "1700000000");
    const box = memoryStore();
    const fetchMock = fetchPayment(paymentResource());
    const input = {
      headers: { "x-signature": header, "x-request-id": "req-1" },
      query: { "data.id": "987654", type: "payment" },
      body: { type: "payment", data: { id: "111" } },
      secret,
      accessToken: token,
    };
    const first = await completeMercadoPagoNotification(box.store, input, fetchMock);
    const second = await completeMercadoPagoNotification(box.store, input, fetchMock);
    expect(first.http).toBe(200);
    expect(first.body.ok).toBe(true);
    expect(first.body.already).toBe(false);
    expect(second.body.already).toBe(true);
    expect(box.applies()).toBe(1);
    expect(box.notices()).toBe(1);
    expect(box.read().paymentStatus).toBe("approved");
    expect(String(fetchMock.mock.calls[0][0])).toBe("https://api.mercadopago.com/v1/payments/987654");
    expect(fetchMock.mock.calls[0][1]?.headers).toMatchObject({ Authorization: `Bearer ${token}` });
  });

  it("rejects an amount or currency that does not match the order", async () => {
    const { header } = await signed("987654", "req-1", "1700000000");
    const box = memoryStore();
    const input = {
      headers: { "x-signature": header, "x-request-id": "req-1" },
      query: { "data.id": "987654", type: "payment" },
      secret,
      accessToken: token,
    };
    const short = await completeMercadoPagoNotification(box.store, input, fetchPayment(paymentResource({ transaction_amount: 10 })));
    expect(short.http).toBe(400);
    expect(short.body.error).toBe(PAYMENT_AMOUNT);
    const otherCurrency = await completeMercadoPagoNotification(box.store, input, fetchPayment(paymentResource({ currency_id: "USD" })));
    expect(otherCurrency.http).toBe(400);
    expect(otherCurrency.body.error).toBe(PAYMENT_AMOUNT);
    expect(box.applies()).toBe(0);
    expect(box.notices()).toBe(0);
    expect(box.read().paymentStatus).toBe("pending");
  });

  it("keeps PagoEfectivo pending and records a rejection without paying twice", async () => {
    const { header } = await signed("987654", "req-1", "1700000000");
    const input = {
      headers: { "x-signature": header, "x-request-id": "req-1" },
      query: { "data.id": "987654", type: "payment" },
      secret,
      accessToken: token,
    };
    const pendingBox = memoryStore();
    const pending = await completeMercadoPagoNotification(
      pendingBox.store,
      input,
      fetchPayment(paymentResource({ status: "pending", payment_type_id: "atm", payment_method_id: "pagoefectivo" })),
    );
    const pendingAgain = await completeMercadoPagoNotification(
      pendingBox.store,
      input,
      fetchPayment(paymentResource({ status: "pending", payment_type_id: "atm", payment_method_id: "pagoefectivo" })),
    );
    expect(pending.body).toMatchObject({ ok: true, pending: true, status: "pending" });
    expect(pendingAgain.body.pending).toBe(true);
    expect(pendingBox.applies()).toBe(0);
    expect(pendingBox.read().paymentStatus).toBe("pending");

    const rejectedBox = memoryStore();
    const rejected = await completeMercadoPagoNotification(rejectedBox.store, input, fetchPayment(paymentResource({ status: "rejected" })));
    const rejectedAgain = await completeMercadoPagoNotification(rejectedBox.store, input, fetchPayment(paymentResource({ status: "rejected" })));
    expect(rejected.body).toMatchObject({ declined: true, already: false });
    expect(rejectedAgain.body.already).toBe(true);
    expect(rejectedBox.rejects()).toBe(1);
    expect(rejectedBox.applies()).toBe(0);
    const later = await completeMercadoPagoNotification(rejectedBox.store, input, fetchPayment(paymentResource({ status: "approved" })));
    expect(later.body.ok).toBe(true);
    expect(later.body.already).toBe(false);
    expect(rejectedBox.applies()).toBe(1);
    expect(rejectedBox.read().paymentStatus).toBe("approved");

    const paid = memoryStore({ ...order, paymentStatus: "approved" });
    const lateReject = await completeMercadoPagoNotification(paid.store, input, fetchPayment(paymentResource({ status: "rejected" })));
    expect(lateReject.body.already).toBe(true);
    expect(paid.rejects()).toBe(0);
    expect(paid.read().paymentStatus).toBe("approved");
  });

  it("does not fetch a payment when the signature is wrong", async () => {
    const box = memoryStore();
    const fetchMock = vi.fn();
    const result = await completeMercadoPagoNotification(
      box.store,
      {
        headers: { "x-signature": "ts=1700000000,v1=deadbeef", "x-request-id": "req-1" },
        query: { "data.id": "987654", type: "payment" },
        secret,
        accessToken: token,
      },
      fetchMock,
    );
    expect(result.http).toBe(400);
    expect(result.body).toMatchObject({ status: "bad_signature", error: PAYMENT_BAD_SIGNATURE });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(box.applies()).toBe(0);

    const ignored = await completeMercadoPagoNotification(
      box.store,
      {
        headers: { "x-signature": (await signed("55", "req-1", "1700000000")).header, "x-request-id": "req-1" },
        query: { "data.id": "55", type: "merchant_order" },
        secret,
        accessToken: token,
      },
      fetchMock,
    );
    expect(ignored.body.ignored).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("answers the webhook without the order payload", async () => {
    const { header } = await signed("987654", "req-1", "1700000000");
    const { mercadoPagoWebhook } = await import("../api/payments/mercadopago-webhook.mjs");
    const box = memoryStore();
    const sent = capture();
    await mercadoPagoWebhook(
      {
        method: "POST",
        headers: { "x-signature": header, "x-request-id": "req-1" },
        query: { "data.id": "987654", type: "payment" },
        body: { type: "payment", data: { id: "987654" } },
      },
      sent.res,
      { env: { MERCADOPAGO_ACCESS_TOKEN: token, MERCADOPAGO_WEBHOOK_SECRET: secret }, store: box.store, fetchImpl: fetchPayment(paymentResource()) },
    );
    expect(sent.sent.status).toBe(200);
    expect(sent.sent.body).toMatchObject({ ok: true, already: false });
    expect(sent.sent.body).not.toHaveProperty("order");
    expect(JSON.stringify(sent.sent.body)).not.toContain("ana@");
    expect(readMercadoPagoPayment(paymentResource({ transaction_amount: 59 }))?.amountCents).toBe(5900);
    expect(mercadoPagoConfirmationState({ paymentMethod: "card", paymentStatus: "pending" })).toBe("hidden");
    expect(mercadoPagoConfirmationState({ paymentMethod: "mercadopago", paymentStatus: "pending", remoteStatus: "approved" })).toBe("approved");
    expect(mercadoPagoConfirmationState({ paymentMethod: "mercadopago", paymentStatus: "approved", remoteStatus: "rejected" })).toBe("approved");
    expect(mercadoPagoConfirmationState({ paymentMethod: "mercadopago", paymentStatus: "pending" })).toBe("pending");
  });
});
