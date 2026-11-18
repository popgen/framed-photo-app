import { siteUrl } from "./env";
import { formatSoles } from "./money";
import { STATUS_LABEL, type Order, type OrderStatus } from "./types";

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "hola";
}

export function paidMessage(order: Pick<Order, "number" | "customerName" | "totalCents" | "christmasNote" | "publicToken">): string {
  return `Hola ${firstName(order.customerName)}, recibimos tu pedido en Mi Fotito (${formatSoles(order.totalCents)}). ${order.christmasNote} Sigue el estado: ${siteUrl()}/pedido/${order.publicToken}`;
}

export function statusMessage(order: Pick<Order, "number" | "customerName" | "publicToken" | "trackingNumber">, status: OrderStatus): string {
  const name = firstName(order.customerName);
  const link = `${siteUrl()}/pedido/${order.publicToken}`;
  if (status === "in_review") return `Hola ${name}, estamos revisando tu foto antes de imprimir. ${link}`;
  if (status === "printed") return `Hola ${name}, tu foto ya está impresa. ${link}`;
  if (status === "framed") return `Hola ${name}, tu marco ya está armado. ${link}`;
  if (status === "shipped") return `Hola ${name}, tu pedido ya va en camino${order.trackingNumber ? `. Guía: ${order.trackingNumber}` : ""}. ${link}`;
  if (status === "delivered") return `Hola ${name}, tu recuerdo figura como entregado. Si llegó dañado, pide la reposición en ${link}`;
  return `Hola ${name}, tu pedido ahora está: ${STATUS_LABEL[status]}. ${link}`;
}

export function blurryMessage(order: Pick<Order, "number" | "customerName">, note: string): string {
  return `Hola ${firstName(order.customerName)}, revisamos tu foto y se ve borrosa para imprimirla bien. ${note.trim()} ¿Nos puedes enviar una más nítida por aquí?`;
}

export function referralMessage(name: string, code: string): string {
  return `Hola ${firstName(name)}, tu código de amigo es ${code}. Quien lo use ahorra S/ 15 y tú recibes S/ 15 de saldo para tu próximo marco.`;
}

export function giftCardMessage(card: { code: string; initialCents: number; recipientName: string; message?: string | null }): string {
  const note = card.message?.trim() ? ` Mensaje: ${card.message.trim()}` : "";
  return `Hola ${firstName(card.recipientName)}, te regalaron ${formatSoles(card.initialCents)} en Mi Fotito. Tu código es ${card.code}.${note} Úsalo al pagar en ${siteUrl()}`;
}

export function replacementMessage(order: Pick<Order, "number" | "customerName" | "publicToken">): string {
  return `Hola ${firstName(order.customerName)}, vamos a reponer tu marco sin costo. ${siteUrl()}/pedido/${order.publicToken}`;
}
