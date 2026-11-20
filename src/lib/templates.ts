import { DONATION_CENTS, donationSummaryText } from "./donation";
import { siteUrl } from "./env";
import { formatSoles } from "./money";
import { isTestOnlyCart } from "./test-product";
import { STATUS_LABEL, type Order, type OrderStatus } from "./types";

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "hola";
}

export function paidMessage(order: Pick<Order, "number" | "customerName" | "totalCents" | "christmasNote" | "publicToken" | "isGift" | "giftNote" | "giftNoteTo" | "giftNoteMessage" | "giftNoteFrom" | "hidePrices" | "donationCents"> & { items?: Order["items"] }): string {
  const donation = order.donationCents === DONATION_CENTS ? ` ${donationSummaryText()}.` : "";
  if (isTestOnlyCart(order.items)) {
    return `Hola ${firstName(order.customerName)}, recibimos el pago de tu pedido de prueba ${order.number} (${formatSoles(order.totalCents)}).${donation} No entra a producción.`;
  }
  return `Hola ${firstName(order.customerName)}, recibimos tu pedido ${order.number} en Mi Fotito (${formatSoles(order.totalCents)}). ${order.christmasNote}${donation}${giftNoteSentence(order)} Sigue el estado: ${siteUrl()}/pedido/${order.publicToken}`;
}

function storedJson(message: string): boolean {
  if (!message.startsWith("{")) return false;
  try {
    const parsed = JSON.parse(message) as { message?: unknown };
    return typeof parsed.message === "string";
  } catch {
    return false;
  }
}

function giftNoteSentence(order: Pick<Order, "isGift" | "giftNote" | "giftNoteTo" | "giftNoteMessage" | "giftNoteFrom" | "hidePrices">): string {
  const message = (order.giftNoteMessage || order.giftNote || "").trim();
  if (!message || storedJson(message)) return " ";
  const to = order.giftNoteTo?.trim() ? ` para ${order.giftNoteTo.trim()}` : "";
  const from = order.giftNoteFrom?.trim() ? `, de ${order.giftNoteFrom.trim()}` : "";
  const prices = order.hidePrices ? " La caja va sin precios." : "";
  const gift = order.isGift ? " Es un regalo." : "";
  return ` Incluimos una nota impresa${to}${from}: «${message}».${prices}${gift} `;
}

export function statusMessage(order: Pick<Order, "number" | "customerName" | "publicToken" | "trackingNumber">, status: OrderStatus): string {
  const name = firstName(order.customerName);
  const link = `${siteUrl()}/pedido/${order.publicToken}`;
  if (status === "in_review") return `Hola ${name}, estamos revisando la foto de tu pedido ${order.number} antes de imprimir. ${link}`;
  if (status === "printed") return `Hola ${name}, la foto de tu pedido ${order.number} ya está impresa. ${link}`;
  if (status === "framed") return `Hola ${name}, tu marco ${order.number} ya está armado. ${link}`;
  if (status === "shipped") return `Hola ${name}, tu pedido ${order.number} ya va en camino${order.trackingNumber ? `. Guía: ${order.trackingNumber}` : ""}. ${link}`;
  if (status === "delivered") return `Hola ${name}, tu recuerdo ${order.number} figura como entregado. Si llegó dañado, pide la reposición en ${link}`;
  return `Hola ${name}, tu pedido ${order.number} ahora está: ${STATUS_LABEL[status]}. ${link}`;
}

export function blurryMessage(order: Pick<Order, "number" | "customerName">, note: string): string {
  return `Hola ${firstName(order.customerName)}, revisamos la foto de tu pedido ${order.number} y se ve borrosa para imprimirla bien. ${note.trim()} ¿Nos puedes enviar una más nítida por aquí?`;
}

export function referralMessage(name: string, code: string): string {
  return `Hola ${firstName(name)}, tu código de amigo es ${code}. Quien lo use ahorra S/ 15 y tú recibes S/ 15 de saldo para tu próximo marco.`;
}

export function giftCardMessage(card: { code: string; initialCents: number; recipientName: string; message?: string | null }): string {
  const note = card.message?.trim() ? ` Mensaje: ${card.message.trim()}` : "";
  return `Hola ${firstName(card.recipientName)}, te regalaron ${formatSoles(card.initialCents)} en Mi Fotito. Tu código es ${card.code}.${note} Úsalo al pagar en ${siteUrl()}`;
}

export function replacementMessage(order: Pick<Order, "number" | "customerName" | "publicToken">): string {
  return `Hola ${firstName(order.customerName)}, vamos a reponer tu marco sin costo. El nuevo pedido es ${order.number}. ${siteUrl()}/pedido/${order.publicToken}`;
}
