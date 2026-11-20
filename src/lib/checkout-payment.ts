import type { CheckoutInput, Order } from "./types";

export type CheckoutPayMethod = "card" | "mercadopago";

export type CheckoutPayOption = {
  id: CheckoutPayMethod;
  label: string;
  hint: string;
};

export const IZIPAY_LABEL = "Izipay";
export const IZIPAY_HINT = "tarjeta de crédito o débito";
export const MERCADO_PAGO_LABEL = "Mercado Pago";
export const MERCADO_PAGO_HINT = "Yape, cuotas, saldo o PagoEfectivo";

export function checkoutPayOptions(mercadoPago: boolean): CheckoutPayOption[] {
  const options: CheckoutPayOption[] = [{ id: "card", label: IZIPAY_LABEL, hint: IZIPAY_HINT }];
  if (mercadoPago) options.push({ id: "mercadopago", label: MERCADO_PAGO_LABEL, hint: MERCADO_PAGO_HINT });
  return options;
}

function pagoValue(pago: string | string[] | undefined): string {
  const value = Array.isArray(pago) ? pago[0] : pago;
  return (value ?? "").trim().toLowerCase();
}

/**
 * Yape and Plin are not checkout choices. They fall back to Mercado Pago when it
 * is offered, otherwise Izipay (card). An explicit card choice stays on card.
 */
export function resolveCheckoutPayMethod(pago: string | string[] | undefined, mercadoPagoAvailable: boolean): CheckoutPayMethod {
  const value = pagoValue(pago);
  if (value === "card") return "card";
  if (value === "mercadopago" && mercadoPagoAvailable) return "mercadopago";
  return mercadoPagoAvailable ? "mercadopago" : "card";
}

/** The value stored on the order. Never yape or plin. */
export function checkoutPayMethodForSubmit(method: CheckoutPayMethod | null | undefined, mercadoPagoAvailable: boolean): CheckoutPayMethod {
  if (method === "card") return "card";
  if (method === "mercadopago" && mercadoPagoAvailable) return "mercadopago";
  return mercadoPagoAvailable ? "mercadopago" : "card";
}

export const PENDING_MP_NOTE = "Tu pedido sigue pendiente de pago.";

export type SessionPendingOrder = { orderId: string; publicToken: string };
export type SessionReceipt = { id?: string; publicToken?: string };

type ReadReceipt = (token: string) => SessionReceipt | null;
type ReadPending = (cartKey: string) => SessionPendingOrder | null;

function cartKey(items: { id: string }[]): string {
  return items.map((item) => item.id).filter(Boolean).join(".");
}

/**
 * The pending Mercado Pago order for this browser session.
 * A `pedido` token counts only when this session stored the receipt or the cart-keyed pending order.
 * Browser Back has no query string, so the cart key is enough.
 */
export function findSessionPendingMercadoPago(input: {
  pedidoToken?: string | null;
  cartItems: { id: string }[];
  readReceipt: ReadReceipt;
  readPending: ReadPending;
}): SessionPendingOrder | null {
  const pedido = String(input.pedidoToken || "").trim();
  const remembered = input.readPending(cartKey(input.cartItems));
  if (pedido) {
    const receipt = input.readReceipt(pedido);
    if (receipt?.id) return { orderId: String(receipt.id), publicToken: pedido };
    if (remembered?.publicToken === pedido && remembered.orderId) return remembered;
    return null;
  }
  if (!remembered?.orderId || !remembered.publicToken) return null;
  const receipt = input.readReceipt(remembered.publicToken);
  if (receipt?.id) return { orderId: String(receipt.id), publicToken: remembered.publicToken };
  return remembered;
}

export function pendingReuseRejected(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "reuse" in error && (error as { reuse?: boolean }).reuse === false);
}

/** Back-forward cache restores checkout with the pay button still spinning. */
export function checkoutPageShowReset(event: { persisted?: boolean }): boolean {
  return event.persisted === true;
}

export async function readOrderPaymentStatus(publicToken: string, fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    const response = await fetchImpl(`/api/payments/status?pedido=${encodeURIComponent(publicToken)}`);
    const payload = (await response.json().catch(() => null)) as { status?: unknown } | null;
    if (!response.ok || !payload || typeof payload.status !== "string" || !payload.status) return null;
    return payload.status;
  } catch {
    return null;
  }
}

/**
 * Reuse a pending Mercado Pago order (update, then a new preference) instead of placing another one.
 * Any other status, or an order that is not from this session, places a new order.
 */
export async function placeCheckoutOrder(input: {
  waOrderId?: string | null;
  method: string;
  pedidoToken?: string | null;
  cartItems: { id: string }[];
  orderInput: CheckoutInput;
  readReceipt: ReadReceipt;
  readPending: ReadPending;
  paymentStatus: (publicToken: string) => Promise<string | null>;
  placeOrder: (input: CheckoutInput) => Promise<Order>;
  /** WhatsApp drafts keep the existing local update. */
  updatePendingOrder: (orderId: string, input: CheckoutInput) => Promise<Order>;
  /** Mercado Pago retries. Defaults to updatePendingOrder. Supabase recomputes the order on the server. */
  revisePendingOrder?: (orderId: string, input: CheckoutInput) => Promise<Order>;
}): Promise<Order> {
  if (input.waOrderId) return input.updatePendingOrder(input.waOrderId, input.orderInput);
  const pending = input.method === "mercadopago"
    ? findSessionPendingMercadoPago({
      pedidoToken: input.pedidoToken,
      cartItems: input.cartItems,
      readReceipt: input.readReceipt,
      readPending: input.readPending,
    })
    : null;
  if (pending) {
    const status = await input.paymentStatus(pending.publicToken);
    if (status === "pending") {
      const revise = input.revisePendingOrder ?? input.updatePendingOrder;
      try {
        return await revise(pending.orderId, input.orderInput);
      } catch (error) {
        if (!pendingReuseRejected(error)) throw error;
      }
    }
  }
  return input.placeOrder(input.orderInput);
}
