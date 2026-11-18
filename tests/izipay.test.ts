import { afterEach, describe, expect, it, vi } from "vitest";
import { createPaymentBody, izipayReady, krHash, readPaidAnswer, verifyKrHash } from "../src/lib/izipay";

describe("Izipay form", () => {
  it("needs the four server keys and sends the amount in céntimos", () => {
    expect(izipayReady({ commerceId: "1", apiKey: "a", publicKey: "p", hmacKey: "h" })).toBe(true);
    expect(izipayReady({ commerceId: "1", apiKey: "a", publicKey: "p" })).toBe(false);
    const body = createPaymentBody({
      amountCents: 5900,
      orderId: "ord_1",
      email: "ana@example.com",
      name: "Ana Flores",
      phone: "51987654321",
      identityType: "DNI",
      identityCode: "87654321",
    });
    expect(body.amount).toBe(5900);
    expect(body.currency).toBe("PEN");
    expect(body.customer).toMatchObject({
      email: "ana@example.com",
      billingDetails: { firstName: "Ana", lastName: "Flores", phoneNumber: "+51987654321", identityType: "DNI", identityCode: "87654321", country: "PE" },
    });
  });

  it("trusts only a matching HMAC and a paid status", async () => {
    const answer = JSON.stringify({
      orderStatus: "PAID",
      orderDetails: { orderId: "ord_1", orderTotalAmount: 5900 },
      transactions: [{ uuid: "tx_1", paymentMethodType: "YAPE" }],
    });
    const hash = await krHash(answer, "hmac-key");
    expect(await verifyKrHash(answer, hash.toUpperCase(), "hmac-key")).toBe(true);
    expect(await verifyKrHash(answer, hash, "otra")).toBe(false);
    expect(readPaidAnswer(answer)).toMatchObject({ paid: true, orderId: "ord_1", amountCents: 5900, method: "yape", ref: "tx_1" });
    expect(readPaidAnswer(JSON.stringify({ orderStatus: "UNPAID", orderDetails: { orderId: "ord_1", orderTotalAmount: 5900 } }))?.paid).toBe(false);
  });
});

describe("payments create", () => {
  const keys = ["PAYMENTS_MODE", "IZIPAY_COMMERCE_ID", "IZIPAY_API_KEY", "IZIPAY_PUBLIC_KEY", "IZIPAY_HMAC_KEY", "MERCADOPAGO_ACCESS_TOKEN"] as const;
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));

  afterEach(() => {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    }
    vi.unstubAllGlobals();
  });

  it("asks Izipay for a form token and does not multiply the amount", async () => {
    process.env.PAYMENTS_MODE = "live";
    process.env.IZIPAY_COMMERCE_ID = "shop";
    process.env.IZIPAY_API_KEY = "secret";
    process.env.IZIPAY_PUBLIC_KEY = "public";
    process.env.IZIPAY_HMAC_KEY = "hmac";
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => ({
      ok: true,
      json: async () => ({ status: "SUCCESS", answer: { formToken: "form-1" } }),
      body: init.body,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const { default: handler } = await import("../api/payments/create.mjs");
    const sent: { status?: number; body?: unknown } = {};
    await handler(
      { method: "POST", body: { orderId: "ord_1", amountCents: 6900, method: "card", payer: { email: "ana@example.com", name: "Ana" } } },
      { status(code: number) { sent.status = code; return this; }, json(data: unknown) { sent.body = data; return this; } },
    );
    const raw = String(fetchMock.mock.calls[0][1].body);
    expect(JSON.parse(raw).amount).toBe(6900);
    expect(sent).toMatchObject({ status: 200, body: { provider: "izipay", formToken: "form-1", publicKey: "public" } });
  });
});
