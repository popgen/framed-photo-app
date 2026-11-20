import { readPaidAnswer, verifyKrHash, izipayReady, readIzipayEnv, createPaymentBody, IZIPAY_CREATE_URL, izipayAuthHeader, izipayMethodRejected } from "./izipay";
import {
  buildMercadoPagoPreference,
  mercadoPagoDataId,
  mercadoPagoReady,
  MERCADOPAGO_PAYMENT_URL,
  MERCADOPAGO_PREFERENCE_URL,
  readMercadoPagoEnv,
  readMercadoPagoPayment,
  verifyMercadoPagoSignature,
} from "./mercadopago";

export const PAYMENTS_NOT_CONFIGURED = "Pagos no configurados. Escríbenos a pedidos@mifotito.com.";
export const PAYMENT_DECLINED = "El pago fue rechazado. Puedes intentar otra vez.";
export const PAYMENT_CANCELLED = "Cancelaste el pago. Puedes intentar otra vez.";
export const PAYMENT_BAD_SIGNATURE = "La firma del pago no coincide.";
export const PAYMENT_AMOUNT = "El monto del pago no coincide con el pedido.";
export const PAYMENT_YAPE_NEEDS_IZIPAY = "Yape se cobra con Izipay. Elige tarjeta o escríbenos a pedidos@mifotito.com.";

export type ServerPaymentMode = "mock" | "live";
export type CardProvider = "mock" | "izipay" | "stripe" | "unconfigured";

export function paymentsServerMode(env: Record<string, string | undefined> = process.env): ServerPaymentMode {
  const raw = (env.PAYMENTS_MODE || env.EXPO_PUBLIC_PAYMENTS_MODE || "mock").trim().toLowerCase();
  return raw === "live" ? "live" : "mock";
}

/** Live Checkout Pro is offered only when the access token and webhook secret are set. */
export function mercadoPagoOffered(env: Record<string, string | undefined> = process.env): boolean {
  return paymentsServerMode(env) === "live" && mercadoPagoReady(readMercadoPagoEnv(env));
}

/** Izipay is the default live provider. Stripe is used only when PAYMENT_PROVIDER=stripe. */
export function selectCardProvider(env: Record<string, string | undefined> = process.env): CardProvider {
  if (paymentsServerMode(env) !== "live") return "mock";
  const requested = (env.PAYMENT_PROVIDER || "").trim().toLowerCase();
  if (requested === "stripe") return env.STRIPE_SECRET_KEY ? "stripe" : "unconfigured";
  if (requested === "izipay" || requested === "") return izipayReady(readIzipayEnv(env)) ? "izipay" : "unconfigured";
  return "unconfigured";
}

export function configuredSite(env: Record<string, string | undefined> = process.env): string {
  return (env.SITE_URL || env.EXPO_PUBLIC_SITE_URL || "https://mifotito.com").replace(/\/$/, "");
}

export function paymentMockSecret(env: Record<string, string | undefined> = process.env): string {
  return env.PAYMENT_MOCK_SECRET || env.SUPABASE_SERVICE_ROLE_KEY || "mifotito-mock-payment";
}

export function giftCardAmountCents(value: unknown): number | null {
  const amount = Math.round(Number(value));
  if (!Number.isFinite(amount) || amount < 3000 || amount > 50000) return null;
  return amount;
}

export type PayableOrder = {
  id: string;
  totalCents: number;
  paymentStatus?: string | null;
  publicToken?: string | null;
  email?: string | null;
  customerName?: string | null;
  phone?: string | null;
  number?: string | null;
};

export type PaidUpdate = { method: string; provider: string; ref: string };

export type PaymentStore = {
  getOrder(id: string): Promise<PayableOrder | null>;
  markPaidOnce(id: string, payment: PaidUpdate): Promise<{ already: boolean; order: PayableOrder }>;
  markRejectedOnce?(id: string, payment: PaidUpdate): Promise<{ already: boolean; order: PayableOrder }>;
  notifyPaid?(order: PayableOrder): Promise<void>;
};

type CallbackBody = { http: number; body: Record<string, unknown> };

export async function completeIzipayCallback(
  store: PaymentStore,
  requestBody: Record<string, unknown> | null | undefined,
  hmacKey: string | undefined,
): Promise<CallbackBody> {
  const answer = String(requestBody?.["kr-answer"] || "");
  const hash = String(requestBody?.["kr-hash"] || "");
  if (!hmacKey || !answer || !(await verifyKrHash(answer, hash, hmacKey))) {
    return { http: 400, body: { ok: false, status: "bad_signature", error: PAYMENT_BAD_SIGNATURE } };
  }
  const paid = readPaidAnswer(answer);
  if (!paid?.paid) return { http: 200, body: { ok: false, declined: true, status: "declined", error: PAYMENT_DECLINED } };
  return settleVerified(store, {
    orderId: paid.orderId,
    amountCents: paid.amountCents,
    method: paid.method,
    provider: "izipay",
    ref: paid.ref,
  });
}

export function readStripeCheckout(event: {
  type?: string;
  data?: { object?: { metadata?: { orderId?: string }; client_reference_id?: string; payment_status?: string; amount_total?: number; currency?: string; payment_intent?: string; id?: string } };
}): { paid: boolean; orderId: string; amountCents: number; ref: string; currency: string } | null {
  if (event?.type !== "checkout.session.completed") return null;
  const session = event.data?.object;
  if (!session) return null;
  const orderId = session.metadata?.orderId || session.client_reference_id || "";
  if (!orderId) return null;
  return {
    paid: session.payment_status === "paid",
    orderId,
    amountCents: Number(session.amount_total),
    ref: String(session.payment_intent || session.id || orderId),
    currency: String(session.currency || "").toLowerCase(),
  };
}

export async function verifyStripeSignature(rawBody: string, header: string, secret: string, nowMs = Date.now()): Promise<boolean> {
  if (!rawBody || !header || !secret) return false;
  const parts = header.split(",").map((item) => {
    const index = item.indexOf("=");
    return [item.slice(0, index).trim(), item.slice(index + 1).trim()] as const;
  });
  const timestamp = parts.find((item) => item[0] === "t")?.[1];
  const signatures = parts.filter((item) => item[0] === "v1").map((item) => item[1]);
  if (!timestamp || !signatures.length) return false;
  const age = Math.abs(nowMs / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = await hmacHex(secret, `${timestamp}.${rawBody}`);
  return signatures.some((item) => timingSafeEqual(expected, item.toLowerCase()));
}

export async function completeStripeCallback(
  store: PaymentStore,
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string | undefined,
  nowMs = Date.now(),
): Promise<CallbackBody> {
  if (!webhookSecret || !(await verifyStripeSignature(rawBody, signatureHeader, webhookSecret, nowMs))) {
    return { http: 400, body: { ok: false, status: "bad_signature", error: PAYMENT_BAD_SIGNATURE } };
  }
  let event: Parameters<typeof readStripeCheckout>[0];
  try {
    event = JSON.parse(rawBody);
  } catch {
    return { http: 400, body: { ok: false, status: "bad_signature", error: PAYMENT_BAD_SIGNATURE } };
  }
  const paid = readStripeCheckout(event);
  if (!paid) return { http: 200, body: { ok: true, ignored: true } };
  if (paid.currency !== "pen") return { http: 400, body: { ok: false, error: PAYMENT_AMOUNT } };
  if (!paid.paid) return { http: 200, body: { ok: false, declined: true, status: "declined", error: PAYMENT_DECLINED } };
  return settleVerified(store, { orderId: paid.orderId, amountCents: paid.amountCents, method: "card", provider: "stripe", ref: paid.ref });
}

export async function completeMercadoPagoNotification(
  store: PaymentStore,
  input: {
    headers?: Record<string, string | undefined> | null;
    query?: Record<string, unknown> | null;
    body?: unknown;
    secret?: string;
    accessToken?: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<CallbackBody> {
  const headers = input.headers || {};
  const dataId = mercadoPagoDataId(input.query, input.body);
  const valid = await verifyMercadoPagoSignature({
    xSignature: headerValue(headers, "x-signature"),
    xRequestId: headerValue(headers, "x-request-id"),
    dataId,
    secret: input.secret || "",
  });
  if (!input.secret || !valid) {
    return { http: 400, body: { ok: false, status: "bad_signature", error: PAYMENT_BAD_SIGNATURE } };
  }
  const topic = String(input.query?.type || input.query?.topic || (input.body as { type?: string } | null)?.type || "").toLowerCase();
  if (topic && topic !== "payment") return { http: 200, body: { ok: true, ignored: true } };
  if (!input.accessToken || !/^[A-Za-z0-9_-]{1,64}$/.test(dataId)) {
    return { http: 400, body: { ok: false, status: "bad_signature", error: PAYMENT_BAD_SIGNATURE } };
  }
  let response: { ok: boolean; status: number; json: () => Promise<unknown> };
  try {
    response = await fetchImpl(`${MERCADOPAGO_PAYMENT_URL}/${encodeURIComponent(dataId)}`, {
      headers: { Authorization: `Bearer ${input.accessToken}` },
    });
  } catch {
    return { http: 502, body: { ok: false, error: "Mercado Pago no confirmó el pago. Inténtalo otra vez." } };
  }
  if (!response.ok) return { http: 502, body: { ok: false, error: "Mercado Pago no confirmó el pago. Inténtalo otra vez." } };
  const paid = readMercadoPagoPayment((await response.json().catch(() => null)) as Parameters<typeof readMercadoPagoPayment>[0]);
  if (!paid?.ref) return { http: 400, body: { ok: false, error: "No pudimos leer el pago." } };
  if (paid.currency !== "PEN") return { http: 400, body: { ok: false, error: PAYMENT_AMOUNT } };
  const order = await store.getOrder(paid.orderId);
  if (!order) return { http: 400, body: { ok: false, error: "No encontramos el pedido." } };
  if (Number(order.totalCents) !== paid.amountCents) return { http: 400, body: { ok: false, error: PAYMENT_AMOUNT } };
  const update = { method: "mercadopago", provider: "mercadopago", ref: paid.ref };
  if (paid.status === "approved") {
    if (order.paymentStatus === "approved") {
      return { http: 200, body: { ok: true, already: true, publicToken: order.publicToken || null, order } };
    }
    return settleVerified(store, { orderId: paid.orderId, amountCents: paid.amountCents, ...update });
  }
  if (paid.status === "pending" || paid.status === "in_process" || paid.status === "authorized") {
    if (order.paymentStatus === "approved") return { http: 200, body: { ok: true, already: true, publicToken: order.publicToken || null, order } };
    return { http: 200, body: { ok: true, pending: true, status: paid.status, publicToken: order.publicToken || null } };
  }
  if (paid.status === "rejected" || paid.status === "cancelled") {
    if (order.paymentStatus === "approved") return { http: 200, body: { ok: true, already: true, publicToken: order.publicToken || null, order } };
    const saved = await store.markRejectedOnce?.(order.id, update);
    return {
      http: 200,
      body: {
        ok: false,
        declined: true,
        status: "declined",
        already: saved?.already ?? order.paymentStatus === "rejected",
        error: PAYMENT_DECLINED,
        publicToken: saved?.order.publicToken || order.publicToken || null,
      },
    };
  }
  return { http: 200, body: { ok: true, ignored: true } };
}

async function settleVerified(
  store: PaymentStore,
  payment: { orderId: string; amountCents: number; method: string; provider: string; ref: string },
): Promise<CallbackBody> {
  const order = await store.getOrder(payment.orderId);
  if (!order) return { http: 400, body: { ok: false, error: "No encontramos el pedido." } };
  if (Number(order.totalCents) !== payment.amountCents) return { http: 400, body: { ok: false, error: PAYMENT_AMOUNT } };
  const saved = await store.markPaidOnce(order.id, { method: payment.method, provider: payment.provider, ref: payment.ref });
  if (!saved.already) await store.notifyPaid?.(saved.order);
  return {
    http: 200,
    body: { ok: true, already: saved.already, publicToken: saved.order.publicToken || null, order: saved.order },
  };
}

export type MockToken = {
  orderId: string;
  amountCents: number;
  exp: number;
  kind: "order" | "gift_card";
  code?: string;
  method?: "card" | "yape";
};

export async function signMockToken(payload: MockToken, secret: string): Promise<string> {
  const body = utf8ToBase64Url(JSON.stringify(payload));
  const sig = await hmacHex(secret, body);
  return `${body}.${sig}`;
}

export async function openMockToken(token: string, secret: string, nowMs = Date.now()): Promise<MockToken | null> {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  const expected = await hmacHex(secret, body);
  if (!timingSafeEqual(expected, sig.toLowerCase())) return null;
  try {
    const parsed = JSON.parse(base64UrlToString(body)) as MockToken;
    if (!parsed?.orderId || !Number.isFinite(parsed.amountCents) || !Number.isFinite(parsed.exp)) return null;
    if (parsed.exp < nowMs) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function settleOrderToken(store: PaymentStore, parsed: MockToken): Promise<CallbackBody> {
  return settleVerified(store, {
    orderId: parsed.orderId,
    amountCents: parsed.amountCents,
    method: parsed.method === "yape" ? "yape" : "card",
    provider: "mock",
    ref: `mock_${parsed.orderId}`,
  });
}

export async function requestIzipayForm(
  env: Record<string, string | undefined>,
  input: { amountCents: number; orderId: string; email: string; name: string; phone?: string | null; identityType?: "DNI" | "RUC" | null; identityCode?: string | null; method?: "card" | "yape" | null },
  fetchImpl: typeof fetch = fetch,
): Promise<{ formToken: string; publicKey: string; yapeFallback?: boolean } | { error: string }> {
  const izipay = readIzipayEnv(env);
  const commerceId = izipay.commerceId;
  const apiKey = izipay.apiKey;
  const publicKey = izipay.publicKey;
  if (!izipayReady(izipay) || !commerceId || !apiKey || !publicKey) return { error: PAYMENTS_NOT_CONFIGURED };
  const post = async (method?: "card" | "yape" | null) => {
    const response = await fetchImpl(IZIPAY_CREATE_URL, {
      method: "POST",
      headers: { Authorization: izipayAuthHeader(commerceId, apiKey), "Content-Type": "application/json" },
      body: JSON.stringify(
        createPaymentBody({
          amountCents: input.amountCents,
          orderId: input.orderId,
          email: input.email,
          name: input.name,
          phone: input.phone || undefined,
          identityType: input.identityType,
          identityCode: input.identityCode,
          method,
        }),
      ),
    });
    const json = (await response.json().catch(() => ({}))) as {
      status?: string;
      answer?: { formToken?: string; errorMessage?: string; errorCode?: string; detailedErrorCode?: string; detailedErrorMessage?: string };
    };
    return { response, json };
  };
  const first = await post(input.method);
  if (first.response.ok && first.json.status === "SUCCESS" && first.json.answer?.formToken) {
    return { formToken: first.json.answer.formToken, publicKey: publicKey, yapeFallback: false };
  }
  if (input.method === "yape" && izipayMethodRejected(first.json)) {
    const fallback = await post(undefined);
    if (fallback.response.ok && fallback.json.status === "SUCCESS" && fallback.json.answer?.formToken) {
      return { formToken: fallback.json.answer.formToken, publicKey: publicKey, yapeFallback: true };
    }
  }
  return { error: "Izipay no pudo abrir el pago. Inténtalo otra vez." };
}

export async function requestMercadoPagoCheckout(
  env: Record<string, string | undefined>,
  input: { amountCents: number; orderId: string; email?: string | null; name?: string | null; description: string; publicToken: string; donationCents?: number | null },
  fetchImpl: typeof fetch = fetch,
): Promise<{ checkoutUrl: string } | { error: string }> {
  const mp = readMercadoPagoEnv(env);
  if (!mercadoPagoReady(mp)) return { error: PAYMENTS_NOT_CONFIGURED };
  const response = await fetchImpl(MERCADOPAGO_PREFERENCE_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${mp.accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(
      buildMercadoPagoPreference({
        amountCents: input.amountCents,
        orderId: input.orderId,
        email: input.email,
        name: input.name,
        description: input.description,
        publicToken: input.publicToken,
        donationCents: input.donationCents,
        site: configuredSite(env),
      }),
    ),
  });
  const json = (await response.json().catch(() => ({}))) as { init_point?: string; sandbox_init_point?: string };
  const checkoutUrl = json.init_point || json.sandbox_init_point;
  if (response.ok && checkoutUrl) return { checkoutUrl };
  return { error: "Mercado Pago no pudo abrir el pago. Inténtalo otra vez." };
}

export async function requestStripeCheckout(
  env: Record<string, string | undefined>,
  input: { amountCents: number; orderId: string; email?: string | null; description: string; successUrl: string; cancelUrl: string },
  fetchImpl: typeof fetch = fetch,
): Promise<{ checkoutUrl: string } | { error: string }> {
  if (!env.STRIPE_SECRET_KEY) return { error: PAYMENTS_NOT_CONFIGURED };
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", input.successUrl);
  body.set("cancel_url", input.cancelUrl);
  body.set("client_reference_id", input.orderId);
  body.set("metadata[orderId]", input.orderId);
  if (input.email) body.set("customer_email", input.email);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", "pen");
  body.set("line_items[0][price_data][unit_amount]", String(Math.round(input.amountCents)));
  body.set("line_items[0][price_data][product_data][name]", input.description.slice(0, 120));
  const response = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await response.json().catch(() => ({}))) as { url?: string };
  if (response.ok && json.url) return { checkoutUrl: json.url };
  return { error: "Stripe no pudo abrir el pago. Inténtalo otra vez." };
}

function headerValue(headers: Record<string, string | undefined>, name: string): string {
  const target = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === target) return String(value || "");
  }
  return "";
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
  return [...sig].map((item) => item.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let i = 0; i < left.length; i += 1) diff |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return diff === 0;
}

function utf8ToBase64Url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = "";
  for (const item of bytes) bin += String.fromCharCode(item);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToString(value: string): string {
  const pad = value.length % 4 === 0 ? "" : "=".repeat(4 - (value.length % 4));
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const bytes = Uint8Array.from(bin, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
