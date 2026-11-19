import { afterEach, describe, expect, it, vi } from "vitest";
import { createPaymentBody, izipayMethodRejected, izipayPagoCopy, izipayReady, izipaySmartFormExpanded, krHash, paymentMethodsFor, readPaidAnswer, verifyKrHash, IZIPAY_PAYMENT_METHOD_CARDS, IZIPAY_PAYMENT_METHOD_YAPE } from "../src/lib/izipay";
import { requestIzipayForm } from "../src/lib/payments";

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
    expect(body.paymentMethods).toBeUndefined();
  });

  it("sends the Izipay paymentMethods code for Yape or card", () => {
    const base = { amountCents: 5900, orderId: "ord_1", email: "ana@example.com", name: "Ana Flores" };
    expect(paymentMethodsFor("yape")).toEqual([IZIPAY_PAYMENT_METHOD_YAPE]);
    expect(paymentMethodsFor("card")).toEqual([IZIPAY_PAYMENT_METHOD_CARDS]);
    expect(createPaymentBody({ ...base, method: "yape" }).paymentMethods).toEqual(["YAPE"]);
    expect(createPaymentBody({ ...base, method: "card" }).paymentMethods).toEqual(["CARDS"]);
  });

  it("explains the Yape fallback and expands the card form when Yape is unavailable", () => {
    expect(izipayMethodRejected({ status: "ERROR", answer: { errorCode: "PSP_610", detailedErrorCode: "NO_ACCEPTANCE_AGREEMENT_AVAILABLE" } })).toBe(true);
    expect(izipayMethodRejected({ status: "SUCCESS" })).toBe(false);
    expect(izipayPagoCopy("yape")).toBe("Paga con Yape en la pasarela de Izipay.");
    expect(izipayPagoCopy("card")).toBe("Paga con tarjeta en la pasarela de Izipay.");
    expect(izipayPagoCopy("yape", true)).toMatch(/No pudimos abrir Yape/);
    expect(izipaySmartFormExpanded("yape")).toBe(false);
    expect(izipaySmartFormExpanded("yape", true)).toBe(true);
    expect(izipaySmartFormExpanded("card")).toBe(true);
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
    const { createPayment } = await import("../api/payments/create.mjs");
    const sent: { status?: number; body?: unknown } = {};
    await createPayment(
      { method: "POST", body: { orderId: "ord_1", amountCents: 1, method: "card" } },
      { status(code: number) { sent.status = code; return this; }, json(data: unknown) { sent.body = data; return this; } },
      {
        env: {
          PAYMENTS_MODE: "live",
          IZIPAY_COMMERCE_ID: "shop",
          IZIPAY_API_KEY: "secret",
          IZIPAY_PUBLIC_KEY: "public",
          IZIPAY_HMAC_KEY: "hmac",
        },
        fetchImpl: fetchMock,
        loadOrder: async () => ({
          id: "ord_1",
          totalCents: 6900,
          email: "ana@example.com",
          customerName: "Ana Flores",
          phone: "51987654321",
          number: "MF-1",
          publicToken: "tok",
          taxIdType: "DNI",
          taxId: "87654321",
        }),
      },
    );
    const raw = String(fetchMock.mock.calls[0][1].body);
    expect(JSON.parse(raw).amount).toBe(6900);
    expect(JSON.parse(raw).paymentMethods).toEqual(["CARDS"]);
    expect(sent).toMatchObject({ status: 200, body: { provider: "izipay", formToken: "form-1", publicKey: "public", method: "card", yapeFallback: false } });
  });

  it("asks Izipay for Yape and retries without a method filter when the shop has no Yape agreement", async () => {
    const keys = {
      PAYMENTS_MODE: "live",
      IZIPAY_COMMERCE_ID: "shop",
      IZIPAY_API_KEY: "secret",
      IZIPAY_PUBLIC_KEY: "public",
      IZIPAY_HMAC_KEY: "hmac",
    };
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body));
      if (body.paymentMethods?.includes("YAPE")) {
        return {
          ok: true,
          json: async () => ({
            status: "ERROR",
            answer: { errorCode: "PSP_610", detailedErrorCode: "NO_ACCEPTANCE_AGREEMENT_AVAILABLE", errorMessage: "No merchant acceptance agreement available" },
          }),
        };
      }
      return { ok: true, json: async () => ({ status: "SUCCESS", answer: { formToken: "form-fallback" } }) };
    });
    const opened = await requestIzipayForm(
      keys,
      { amountCents: 6900, orderId: "ord_1", email: "ana@example.com", name: "Ana Flores", method: "yape" },
      fetchMock as unknown as typeof fetch,
    );
    expect("formToken" in opened && opened.formToken).toBe("form-fallback");
    expect("yapeFallback" in opened && opened.yapeFallback).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchMock.mock.calls[0][1].body)).paymentMethods).toEqual(["YAPE"]);
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body)).paymentMethods).toBeUndefined();

    const { createPayment } = await import("../api/payments/create.mjs");
    const sent: { status?: number; body?: unknown } = {};
    await createPayment(
      { method: "POST", body: { orderId: "ord_1", method: "yape" } },
      { status(code: number) { sent.status = code; return this; }, json(data: unknown) { sent.body = data; return this; } },
      {
        env: keys,
        fetchImpl: fetchMock,
        loadOrder: async () => ({
          id: "ord_1",
          totalCents: 6900,
          email: "ana@example.com",
          customerName: "Ana Flores",
          phone: "51987654321",
          number: "MF-1",
          publicToken: "tok",
          taxIdType: "DNI",
          taxId: "87654321",
        }),
      },
    );
    expect(sent).toMatchObject({ status: 200, body: { provider: "izipay", formToken: "form-fallback", method: "yape", yapeFallback: true } });
  });
});
