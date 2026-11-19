import { formatSoles } from "./money";
import type { Order } from "./types";

export type MoneyLine = { label: string; text: string };

type BreakdownOrder = Pick<
  Order,
  | "subtotalCents"
  | "frameDiscountCents"
  | "frameDiscountLabel"
  | "promoCode"
  | "promoDiscountCents"
  | "referralCode"
  | "referralDiscountCents"
  | "creditAppliedCents"
  | "giftCardCode"
  | "giftCardAppliedCents"
  | "giftNoteCents"
  | "giftWrapCents"
  | "totalCents"
> & { shippingCents?: number | null };

export function orderMoneyLines(order: BreakdownOrder): MoneyLine[] {
  const discount =
    (order.frameDiscountCents || 0) + (order.promoDiscountCents || 0) + (order.referralDiscountCents || 0) + (order.creditAppliedCents || 0);
  const lines: MoneyLine[] = [{ label: "Subtotal", text: formatSoles(order.subtotalCents) }];
  if (order.frameDiscountCents) lines.push({ label: order.frameDiscountLabel || "Descuento de marcos", text: formatSoles(-order.frameDiscountCents) });
  if (order.promoDiscountCents) lines.push({ label: order.promoCode ? `Promo ${order.promoCode}` : "Promo", text: formatSoles(-order.promoDiscountCents) });
  if (order.referralDiscountCents) lines.push({ label: order.referralCode ? `Referido ${order.referralCode}` : "Referido", text: formatSoles(-order.referralDiscountCents) });
  if (order.creditAppliedCents) lines.push({ label: "Saldo", text: formatSoles(-order.creditAppliedCents) });
  if (!discount) lines.push({ label: "Descuentos", text: formatSoles(0) });
  lines.push({
    label: order.giftCardCode ? `Tarjeta de regalo ${order.giftCardCode}` : "Tarjeta de regalo",
    text: formatSoles(-(order.giftCardAppliedCents || 0)),
  });
  lines.push({ label: "Nota de regalo", text: formatSoles(order.giftNoteCents ?? 0) });
  lines.push({ label: "Envoltorio", text: formatSoles(order.giftWrapCents || 0) });
  lines.push({ label: "Envío", text: formatSoles(order.shippingCents || 0) });
  lines.push({ label: "Total", text: formatSoles(order.totalCents) });
  return lines;
}

export function paymentStatusLabel(status: string | null | undefined): "Pagado" | "Pendiente" | "Fallido" {
  const value = (status || "").toLowerCase();
  if (value === "approved" || value === "paid" || value === "success") return "Pagado";
  if (value === "rejected" || value === "failed" || value === "failure" || value === "error") return "Fallido";
  return "Pendiente";
}

export function paymentMethodLabel(method: string | null | undefined): string {
  const value = (method || "").toLowerCase();
  if (value === "yape") return "Yape";
  if (value === "card" || value === "tarjeta") return "Tarjeta";
  if (value === "plin") return "Plin";
  if (value === "mercadopago") return "Mercado Pago";
  if (value === "gift_card" || value === "giftcard") return "Tarjeta de regalo";
  if (value === "replacement") return "Reposición";
  if (!value) return "Sin registrar";
  return method ?? "Sin registrar";
}

export function giftWrapBadge(title: string | null | undefined): string {
  const name = title?.trim() || "Envoltorio de Navidad";
  return `Envolver para regalo · ${name}`;
}
