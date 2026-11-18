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

export function createPaymentBody(input: {
  amountCents: number;
  orderId: string;
  email: string;
  name: string;
  phone?: string;
  identityType?: "DNI" | "RUC" | null;
  identityCode?: string | null;
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
  return {
    amount: Math.round(input.amountCents),
    currency: "PEN",
    orderId: input.orderId.slice(0, 64),
    customer: { email: input.email, billingDetails: billing },
  };
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
