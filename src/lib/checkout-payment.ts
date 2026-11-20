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
