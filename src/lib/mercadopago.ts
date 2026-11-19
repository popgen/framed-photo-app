export const MERCADOPAGO_PREFERENCE_URL = "https://api.mercadopago.com/checkout/preferences";
export const MERCADOPAGO_PAYMENT_URL = "https://api.mercadopago.com/v1/payments";
export const MERCADOPAGO_NOTIFICATION_URL = "https://mifotito.com/api/payments/mercadopago-webhook";
export const MERCADOPAGO_SITE = "https://mifotito.com";
export const MERCADOPAGO_STATEMENT = "MIFOTITO";
/** Credit-card cuotas offered on Checkout Pro. The seller account can offer fewer. */
export const MERCADOPAGO_MAX_INSTALLMENTS = 12;

export type MercadoPagoEnv = {
  accessToken: string;
  publicKey: string;
  webhookSecret: string;
};

export function readMercadoPagoEnv(source: Record<string, string | undefined> = process.env): MercadoPagoEnv {
  return {
    accessToken: source.MERCADOPAGO_ACCESS_TOKEN?.trim() || "",
    publicKey: source.MERCADOPAGO_PUBLIC_KEY?.trim() || "",
    webhookSecret: source.MERCADOPAGO_WEBHOOK_SECRET?.trim() || "",
  };
}

/** Checkout Pro needs the access token and the webhook secret. The public key is only for Bricks. */
export function mercadoPagoReady(env: Pick<MercadoPagoEnv, "accessToken" | "webhookSecret">): boolean {
  return Boolean(env.accessToken && env.webhookSecret);
}

export function centsToUnitPrice(cents: number): number {
  return Number((Math.round(cents) / 100).toFixed(2));
}

export function solesToCents(amount: number): number | null {
  if (!Number.isFinite(amount)) return null;
  const cents = Math.round(amount * 100);
  return Number.isFinite(cents) ? cents : null;
}

export function orderConfirmationUrl(publicToken: string): string {
  const token = encodeURIComponent(publicToken);
  return `${MERCADOPAGO_SITE}/confirmacion/${token}`;
}

/**
 * Checkout Pro preference for Peru.
 * Cards keep cuotas. account_money is the Mercado Pago balance.
 * In Peru, PagoEfectivo is the `atm` type (method `pagoefectivo`); `ticket` is not offered.
 * No payment type is excluded, and the price is the order total with no surcharge.
 */
export function buildMercadoPagoPreference(input: {
  amountCents: number;
  orderId: string;
  email?: string | null;
  name?: string | null;
  description: string;
  publicToken: string;
}): Record<string, unknown> {
  const confirmation = orderConfirmationUrl(input.publicToken);
  const payer: Record<string, string> = {};
  const name = input.name?.trim();
  const email = input.email?.trim();
  if (name) payer.name = name.slice(0, 256);
  if (email) payer.email = email;
  return {
    items: [
      {
        title: (input.description || "Pedido Mi Fotito").slice(0, 256),
        quantity: 1,
        currency_id: "PEN",
        unit_price: centsToUnitPrice(input.amountCents),
      },
    ],
    payer,
    payment_methods: {
      installments: MERCADOPAGO_MAX_INSTALLMENTS,
      default_installments: 1,
    },
    binary_mode: false,
    statement_descriptor: MERCADOPAGO_STATEMENT,
    external_reference: input.orderId,
    back_urls: {
      success: confirmation,
      pending: confirmation,
      failure: confirmation,
    },
    auto_return: "approved",
    notification_url: MERCADOPAGO_NOTIFICATION_URL,
  };
}

export function parseMercadoPagoSignature(header: string): { ts: string; v1: string } {
  let ts = "";
  let v1 = "";
  for (const part of String(header || "").split(",")) {
    const index = part.indexOf("=");
    if (index <= 0) continue;
    const key = part.slice(0, index).trim().toLowerCase();
    const value = part.slice(index + 1).trim();
    if (key === "ts") ts = value;
    if (key === "v1") v1 = value;
  }
  return { ts, v1 };
}

/** Manifest from the Mercado Pago webhook docs. Blank id or request-id pairs are omitted. data.id is lowercased. */
export function mercadoPagoManifest(dataId: string, requestId: string, ts: string): string {
  const parts: string[] = [];
  const id = dataId.trim().toLowerCase();
  const request = requestId.trim();
  if (id) parts.push(`id:${id}`);
  if (request) parts.push(`request-id:${request}`);
  parts.push(`ts:${ts.trim()}`);
  return `${parts.join(";")};`;
}

export function mercadoPagoDataId(query: Record<string, unknown> | null | undefined, body: unknown): string {
  const fromQuery = query?.["data.id"] ?? query?.["data_id"];
  if (fromQuery != null && String(fromQuery).trim()) return String(fromQuery).trim();
  if (!body || typeof body !== "object") return "";
  const id = (body as { data?: { id?: unknown } }).data?.id;
  return id == null ? "" : String(id).trim();
}

export async function verifyMercadoPagoSignature(input: {
  xSignature: string;
  xRequestId: string;
  dataId: string;
  secret: string;
}): Promise<boolean> {
  if (!input.secret || !input.xSignature || !input.dataId.trim()) return false;
  const { ts, v1 } = parseMercadoPagoSignature(input.xSignature);
  if (!ts || !v1) return false;
  const manifest = mercadoPagoManifest(input.dataId, input.xRequestId || "", ts);
  const expected = await hmacHex(input.secret, manifest);
  return timingSafeEqual(expected, v1.toLowerCase());
}

export type MercadoPagoPaymentView = {
  orderId: string;
  amountCents: number;
  currency: string;
  status: string;
  ref: string;
  paymentType: string;
  paymentMethodId: string;
};

/** Reads the payment resource. transaction_amount is the order total; cuota interest lives on total_paid_amount. */
export function readMercadoPagoPayment(payment: {
  id?: number | string;
  status?: string;
  transaction_amount?: number;
  currency_id?: string;
  external_reference?: string;
  payment_type_id?: string;
  payment_method_id?: string;
} | null | undefined): MercadoPagoPaymentView | null {
  if (!payment) return null;
  const orderId = String(payment.external_reference || "").trim();
  const amountCents = solesToCents(Number(payment.transaction_amount));
  if (!orderId || amountCents == null) return null;
  return {
    orderId,
    amountCents,
    currency: String(payment.currency_id || "").trim().toUpperCase(),
    status: String(payment.status || "").trim().toLowerCase(),
    ref: String(payment.id ?? ""),
    paymentType: String(payment.payment_type_id || ""),
    paymentMethodId: String(payment.payment_method_id || ""),
  };
}

export function mercadoPagoConfirmationState(input: {
  paymentMethod?: string | null;
  paymentStatus?: string | null;
  remoteStatus?: string | null;
}): "hidden" | "pending" | "rejected" | "approved" {
  if (input.paymentMethod !== "mercadopago") return "hidden";
  if (input.remoteStatus === "approved" || input.paymentStatus === "approved") return "approved";
  if (input.remoteStatus === "rejected" || input.paymentStatus === "rejected") return "rejected";
  return "pending";
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
