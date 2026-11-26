import { describe, expect, it, vi } from "vitest";
import { krHash } from "../src/lib/izipay";
import { paidEmailRequest } from "../src/lib/order-mail";
import {
  completeIzipayCallback,
  completeStripeCallback,
  openMockToken,
  PAYMENTS_NOT_CONFIGURED,
  paymentMockSecret,
  selectCardProvider,
  signMockToken,
  verifyStripeSignature,
  type PayableOrder,
  type PaymentStore,
} from "../src/lib/payments";
import { returnOrigin } from "../api/payments/izipay-confirm.mjs";

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
    send(data: unknown) {
      sent.body = data;
      return res;
    },
  };
  return { sent, res };
}

function memoryStore(order: PayableOrder) {
  let current = { ...order };
  let applies = 0;
  let notices = 0;
  const store: PaymentStore = {
    async getOrder(id) {
      return id === current.id ? current : null;
    },
    async markPaidOnce(id, payment) {
      if (current.paymentStatus === "approved") return { already: true, order: current };
      applies += 1;
      current = { ...current, paymentStatus: "approved", paymentRef: payment.ref } as PayableOrder;
      return { already: false, order: current };
    },
    async notifyPaid() {
      notices += 1;
    },
  };
  return { store, applies: () => applies, notices: () => notices, read: () => current };
}

const order: PayableOrder = { id: "ord_1", totalCents: 5900, paymentStatus: "pending", publicToken: "tokenpublico", email: "ana@ejemplo.com", customerName: "Ana", number: "MF-26-2001" };

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
  return [...sig].map((item) => item.toString(16).padStart(2, "0")).join("");
}

describe("card payment callbacks", () => {
  it("marks the order paid once from a signed provider callback", async () => {
    const paid = JSON.stringify({
      orderStatus: "PAID",
      orderDetails: { orderId: "ord_1", orderTotalAmount: 5900 },
      transactions: [{ uuid: "tx_1", paymentMethodType: "CARD" }],
    });
    const hash = await krHash(paid, "hmac-key");
    const box = memoryStore(order);
    const first = await completeIzipayCallback(box.store, { "kr-answer": paid, "kr-hash": hash }, "hmac-key");
    const second = await completeIzipayCallback(box.store, { "kr-answer": paid, "kr-hash": hash }, "hmac-key");
    expect(first.http).toBe(200);
    expect(first.body.ok).toBe(true);
    expect(first.body.already).toBe(false);
    expect(second.body.already).toBe(true);
    expect(box.applies()).toBe(1);
    expect(box.notices()).toBe(1);
    expect(box.read().paymentStatus).toBe("approved");
  });

  it("does not mark a declined or badly signed callback", async () => {
    const declined = JSON.stringify({ orderStatus: "UNPAID", orderDetails: { orderId: "ord_1", orderTotalAmount: 5900 } });
    const hash = await krHash(declined, "hmac-key");
    const box = memoryStore(order);
    const reject = await completeIzipayCallback(box.store, { "kr-answer": declined, "kr-hash": hash }, "hmac-key");
    const forged = await completeIzipayCallback(box.store, { "kr-answer": declined, "kr-hash": "00" }, "hmac-key");
    expect(reject.http).toBe(200);
    expect(reject.body.declined).toBe(true);
    expect(forged.http).toBe(400);
    expect(forged.body.status).toBe("bad_signature");
    expect(box.applies()).toBe(0);
    expect(box.notices()).toBe(0);
  });

  it("marks the order paid from an IPN signed with the REST password", async () => {
    const paid = JSON.stringify({
      orderStatus: "PAID",
      orderDetails: { orderId: "ord_1", orderTotalAmount: 5900 },
      transactions: [{ uuid: "tx_1", paymentMethodType: "CARD" }],
    });
    const hash = await krHash(paid, "prodpassword_test");
    const box = memoryStore(order);
    const env = { hmacKey: "hmac-key", apiKey: "prodpassword_test" };
    const rejected = await completeIzipayCallback(box.store, { "kr-answer": paid, "kr-hash": hash, "kr-hash-key": "password" }, "hmac-key");
    expect(rejected.body.status).toBe("bad_signature");
    const accepted = await completeIzipayCallback(box.store, { "kr-answer": paid, "kr-hash": hash, "kr-hash-key": "password" }, env);
    expect(accepted.http).toBe(200);
    expect(accepted.body.ok).toBe(true);
    expect(box.read().paymentStatus).toBe("approved");
  });

  it("verifies a Stripe webhook and ignores a second delivery", async () => {
    const raw = JSON.stringify({
      type: "checkout.session.completed",
      data: { object: { metadata: { orderId: "ord_1" }, payment_status: "paid", amount_total: 5900, currency: "pen", payment_intent: "pi_1" } },
    });
    const secret = "whsec_test";
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await hmacHex(secret, `${timestamp}.${raw}`);
    const header = `t=${timestamp},v1=${signature}`;
    expect(await verifyStripeSignature(raw, header, secret)).toBe(true);
    expect(await verifyStripeSignature(raw, `t=${timestamp},v1=deadbeef`, secret)).toBe(false);
    const box = memoryStore(order);
    const first = await completeStripeCallback(box.store, raw, header, secret);
    const second = await completeStripeCallback(box.store, raw, header, secret);
    expect(first.body.ok).toBe(true);
    expect(second.body.already).toBe(true);
    expect(box.applies()).toBe(1);
    expect(box.notices()).toBe(1);
    const unpaid = JSON.stringify({
      type: "checkout.session.completed",
      data: { object: { metadata: { orderId: "ord_1" }, payment_status: "unpaid", amount_total: 5900, currency: "pen", id: "cs_1" } },
    });
    const unpaidHeader = `t=${timestamp},v1=${await hmacHex(secret, `${timestamp}.${unpaid}`)}`;
    const declined = await completeStripeCallback(memoryStore(order).store, unpaid, unpaidHeader, secret);
    expect(declined.body.declined).toBe(true);
  });

  it("confirms a mock token and rejects a bad one", async () => {
    const secret = "sandbox-secret";
    const token = await signMockToken({ orderId: "ord_1", amountCents: 5900, exp: Date.now() + 60_000, kind: "order", method: "card" }, secret);
    expect(await openMockToken(token, "otra")).toBeNull();
    const { mockConfirm } = await import("../api/payments/mock-confirm.mjs");
    const box = memoryStore(order);
    const ok = capture();
    await mockConfirm({ method: "POST", body: { token, outcome: "approved" } }, ok.res, { env: { PAYMENTS_MODE: "mock", PAYMENT_MOCK_SECRET: secret }, secret, store: box.store });
    expect(ok.sent.status).toBe(200);
    expect(box.applies()).toBe(1);
    const again = capture();
    await mockConfirm({ method: "POST", body: { token, outcome: "approved" } }, again.res, { env: { PAYMENTS_MODE: "mock", PAYMENT_MOCK_SECRET: secret }, secret, store: box.store });
    expect(again.sent.body).toMatchObject({ already: true });
    expect(box.applies()).toBe(1);
    const declined = capture();
    const fresh = memoryStore({ ...order, paymentStatus: "pending" });
    await mockConfirm({ method: "POST", body: { token, outcome: "declined" } }, declined.res, { env: { PAYMENTS_MODE: "mock" }, secret, store: fresh.store });
    expect(declined.sent.body).toMatchObject({ declined: true });
    expect(fresh.applies()).toBe(0);
    const bad = capture();
    await mockConfirm({ method: "POST", body: { token: "no.firma", outcome: "approved" } }, bad.res, { env: { PAYMENTS_MODE: "mock" }, secret, store: fresh.store });
    expect(bad.sent.status).toBe(400);
  });
});

describe("payment safety", () => {
  it("stays in sandbox unless live keys are present", () => {
    expect(selectCardProvider({ PAYMENTS_MODE: "mock", IZIPAY_COMMERCE_ID: "a" })).toBe("mock");
    expect(selectCardProvider({ PAYMENTS_MODE: "live" })).toBe("unconfigured");
    expect(selectCardProvider({ PAYMENTS_MODE: "live", IZIPAY_COMMERCE_ID: "a", IZIPAY_API_KEY: "b", IZIPAY_PUBLIC_KEY: "c", IZIPAY_HMAC_KEY: "d" })).toBe("izipay");
    expect(selectCardProvider({ PAYMENTS_MODE: "live", PAYMENT_PROVIDER: "stripe", STRIPE_SECRET_KEY: "sk_test" })).toBe("stripe");
    expect(PAYMENTS_NOT_CONFIGURED).toMatch(/Pagos no configurados/);
    expect(paymentMockSecret({})).toBe("mifotito-mock-payment");
  });

  it("refuses an open return origin", () => {
    expect(returnOrigin({ headers: { origin: "https://sitio-falso.com" } })).toBe("https://mifotito.com");
    expect(returnOrigin({ headers: { origin: "https://www.mifotito.com" } })).toBe("https://www.mifotito.com");
    expect(returnOrigin({ headers: { origin: "https://preview.netlify.app" } })).toBe("https://preview.netlify.app");
  });

  it("blocks unauthenticated mark-paid, gift cards and notify", async () => {
    const shop = (await import("../api/shop.mjs")).default;
    const paid = capture();
    await shop({ method: "POST", body: { op: "orders-mark-paid", orderId: "ord_1", method: "card", provider: "izipay" }, query: {}, headers: {} }, paid.res);
    expect(paid.sent.status).toBe(401);
    const gift = capture();
    await shop({ method: "POST", body: { op: "gift-card", amountCents: 9999900, buyerName: "x", buyerPhone: "987654321" }, query: {}, headers: {} }, gift.res);
    expect(gift.sent.status).toBe(401);
    process.env.WHATSAPP_TOKEN = "token";
    process.env.WHATSAPP_PHONE_NUMBER_ID = "phone";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { default: notify } = await import("../api/notify.mjs");
    const sent = capture();
    await notify({ method: "POST", body: { to: "51999999999", body: "hola", channel: "whatsapp" }, headers: {} }, sent.res);
    expect(sent.sent.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
    delete process.env.WHATSAPP_TOKEN;
    delete process.env.WHATSAPP_PHONE_NUMBER_ID;
  });

  it("builds the paid email only when the order has an address and Resend is configured", () => {
    const base = { number: "MF-1", customerName: "Ana", totalCents: 5900, christmasNote: "", publicToken: "abc", email: "ana@ejemplo.com" };
    expect(paidEmailRequest(base, {})).toBeNull();
    expect(paidEmailRequest({ ...base, email: null }, { RESEND_API_KEY: "k", EMAIL_FROM: "pedidos@mifotito.com" })).toBeNull();
    expect(paidEmailRequest(base, { RESEND_API_KEY: "k", EMAIL_FROM: "pedidos@mifotito.com" })?.to).toBe("ana@ejemplo.com");
  });

  it("answers pagos no configurados when live keys are missing", async () => {
    const { createPayment } = await import("../api/payments/create.mjs");
    const sent = capture();
    await createPayment(
      { method: "POST", body: { orderId: "ord_1", amountCents: 1, method: "card" } },
      sent.res,
      { env: { PAYMENTS_MODE: "live" }, loadOrder: async () => order },
    );
    expect(sent.sent.status).toBe(501);
    expect(sent.sent.body).toMatchObject({ error: PAYMENTS_NOT_CONFIGURED });
  });
});
