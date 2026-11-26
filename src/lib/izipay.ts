export const IZIPAY_CREATE_URL = "https://api.micuentaweb.pe/api-payment/V4/Charge/CreatePayment";

export type IzipayEnv = {
  commerceId?: string;
  apiKey?: string;
  publicKey?: string;
  hmacKey?: string;
};

export function izipayReady(env: IzipayEnv): boolean {
  return Boolean(env.commerceId && env.apiKey && env.publicKey && env.hmacKey);
}

export function readIzipayEnv(source: Record<string, string | undefined> = process.env): IzipayEnv {
  return {
    commerceId: source.IZIPAY_COMMERCE_ID,
    apiKey: source.IZIPAY_API_KEY,
    publicKey: source.IZIPAY_PUBLIC_KEY,
    hmacKey: source.IZIPAY_HMAC_KEY,
  };
}

export function izipayAuthHeader(commerceId: string, apiKey: string): string {
  const token = btoa(`${commerceId}:${apiKey}`);
  return `Basic ${token}`;
}

/** CreatePayment paymentMethods values. Field docs: https://secure.micuentaweb.pe/doc/es-PE/rest/V4.0/api/playground/Charge/CreatePayment and https://secure.micuentaweb.pe/doc/es-PE/rest/V4.0/javascript/redirection/custom_filter.html — CARDS is the documented card value in https://secure.micuentaweb.pe/doc/schema-api-v4.json. Yape is not in that schema table; YAPE matches the IPN paymentMethodType already parsed here. */
export const IZIPAY_PAYMENT_METHOD_CARDS = "CARDS";
export const IZIPAY_PAYMENT_METHOD_YAPE = "YAPE";

export function paymentMethodsFor(method?: "card" | "yape" | null): string[] | undefined {
  if (method === "yape") return [IZIPAY_PAYMENT_METHOD_YAPE];
  if (method === "card") return [IZIPAY_PAYMENT_METHOD_CARDS];
  return undefined;
}

export function izipayMethodRejected(payload: {
  status?: string;
  answer?: { errorCode?: string; detailedErrorCode?: string; errorMessage?: string; detailedErrorMessage?: string };
}): boolean {
  if (payload.status === "SUCCESS") return false;
  const answer = payload.answer || {};
  const blob = `${answer.errorCode || ""} ${answer.detailedErrorCode || ""} ${answer.errorMessage || ""} ${answer.detailedErrorMessage || ""}`;
  return /PSP_610|10103|NO_ACCEPTANCE_AGREEMENT|UNSUPPORTED_PAYMENT_METHODS/i.test(blob);
}

export function izipayPagoCopy(method?: "card" | "yape" | null, yapeFallback?: boolean): string {
  if (method === "yape" && yapeFallback) return "No pudimos abrir Yape en Izipay. Puedes pagar con tarjeta en el formulario de abajo.";
  if (method === "yape") return "Paga con Yape en la pasarela de Izipay.";
  if (method === "card") return "Paga con tarjeta en la pasarela de Izipay.";
  return "Tarjeta o Yape, en la pasarela de Izipay.";
}

export function izipaySmartFormExpanded(method?: "card" | "yape" | null, yapeFallback?: boolean): boolean {
  return method !== "yape" || Boolean(yapeFallback);
}

export function createPaymentBody(input: {
  amountCents: number;
  orderId: string;
  email: string;
  name: string;
  phone?: string;
  identityType?: "DNI" | "RUC" | null;
  identityCode?: string | null;
  method?: "card" | "yape" | null;
}): Record<string, unknown> {
  const parts = input.name.trim().split(/\s+/).filter(Boolean);
  const firstName = parts[0] || "Cliente";
  const lastName = parts.slice(1).join(" ") || firstName;
  const billing: Record<string, string> = {
    firstName: firstName.slice(0, 63),
    lastName: lastName.slice(0, 63),
    country: "PE",
  };
  if (input.phone) billing.phoneNumber = input.phone.startsWith("+") ? input.phone : `+${input.phone}`;
  if (input.identityType && input.identityCode) {
    billing.identityType = input.identityType;
    billing.identityCode = input.identityCode;
  }
  const body: Record<string, unknown> = {
    amount: Math.round(input.amountCents),
    currency: "PEN",
    orderId: input.orderId.slice(0, 64),
    customer: { email: input.email, billingDetails: billing },
  };
  const methods = paymentMethodsFor(input.method);
  if (methods) body.paymentMethods = methods;
  return body;
}

export async function krHash(answer: string, hmacKey: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(hmacKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(answer)));
  return [...sig].map((item) => item.toString(16).padStart(2, "0")).join("");
}

export async function verifyKrHash(answer: string, hash: string, hmacKey: string): Promise<boolean> {
  const expected = await krHash(answer, hmacKey);
  const actual = hash.trim().toLowerCase();
  if (expected.length !== actual.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return diff === 0;
}

/** IPN sets kr-hash-key=password and signs with the REST API password. The browser return uses the HMAC key. */
export function izipaySignatureKey(hashKey: string | undefined, env: IzipayEnv): string | undefined {
  const name = String(hashKey || "").trim().toLowerCase();
  if (name === "password") return env.apiKey;
  return env.hmacKey;
}

export async function verifyIzipayPostedHash(
  body: Record<string, unknown> | null | undefined,
  env: IzipayEnv,
): Promise<boolean> {
  const answer = String(body?.["kr-answer"] || "");
  const hash = String(body?.["kr-hash"] || "");
  const key = izipaySignatureKey(body?.["kr-hash-key"] != null ? String(body["kr-hash-key"]) : "", env);
  if (!key || !answer || !hash) return false;
  const algo = String(body?.["kr-hash-algorithm"] || "sha256_hmac").trim().toLowerCase();
  if (algo && algo !== "sha256_hmac" && algo !== "sha256") return false;
  if (await verifyKrHash(answer, hash, key)) return true;
  const normalized = answer.replaceAll("\\/", "/");
  return normalized !== answer && (await verifyKrHash(normalized, hash, key));
}

export function readPaidAnswer(answer: string): { paid: boolean; orderId: string; amountCents: number; ref: string; method: "card" | "yape" } | null {
  let parsed: {
    orderStatus?: string;
    orderDetails?: { orderId?: string; orderTotalAmount?: number };
    transactions?: { uuid?: string; paymentMethodType?: string }[];
  };
  try {
    parsed = JSON.parse(answer);
  } catch {
    return null;
  }
  const status = parsed.orderStatus || "";
  const paid = status === "PAID" || status === "AUTHORISED" || status === "AUTHORIZED";
  const orderId = parsed.orderDetails?.orderId || "";
  const amountCents = Number(parsed.orderDetails?.orderTotalAmount);
  if (!orderId || !Number.isFinite(amountCents)) return null;
  const brand = parsed.transactions?.[0]?.paymentMethodType || "";
  return {
    paid,
    orderId,
    amountCents,
    ref: parsed.transactions?.[0]?.uuid || orderId,
    method: /yape/i.test(brand) ? "yape" : "card",
  };
}
