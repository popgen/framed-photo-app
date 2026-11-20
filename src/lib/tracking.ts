import { maskPhone, maskStreet } from "./order-number";
import { isTestOnlyCart, isTestProductItem } from "./test-product";
import { STATUS_LABEL, type Order, type OrderStatus } from "./types";

export type TrackingCard = {
  publicToken: string;
  number: string;
  status: OrderStatus;
  createdAt: string;
  etaLabel: string;
  christmasNote: string;
  trackingNumber: string | null;
  totalCents: number;
  addressMasked: string;
  recipientPhoneMasked: string | null;
  itemCount: number;
};

export function toTrackingCard(order: Order): TrackingCard {
  return {
    publicToken: order.publicToken,
    number: order.number,
    status: order.status,
    createdAt: order.createdAt,
    etaLabel: order.etaLabel,
    christmasNote: order.christmasNote,
    trackingNumber: order.trackingNumber ?? null,
    totalCents: order.totalCents,
    addressMasked: maskStreet(order.addressLine, order.district, order.department),
    recipientPhoneMasked: maskPhone(order.recipientPhone),
    itemCount: order.items.length,
  };
}

export function sortTracking(cards: TrackingCard[]): TrackingCard[] {
  return [...cards].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export type PublicShipment = {
  number: string;
  itemLabel: string;
  status: OrderStatus;
  etaLabel: string;
  nameHint: string;
  timeline: { status: OrderStatus; label: string; reached: boolean }[];
};

const OPEN_STEPS: OrderStatus[] = ["pending_payment", "paid", "in_review", "printed", "framed", "shipped"];

export function isOpenShipment(status: string): boolean {
  return status !== "delivered" && status !== "cancelled";
}

export function shortName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${[...parts[1]][0]}.`;
}

export function itemKind(items: { card?: unknown; testProduct?: boolean | null; frameId?: string | null }[]): string {
  if (isTestOnlyCart(items)) return "Prueba";
  const cards = items.filter((item) => item.card);
  const frames = items.filter((item) => !item.card && !isTestProductItem(item)).length;
  if (cards.length && frames === 0) return cards.length > 1 ? "Tarjetas" : "Tarjeta";
  if (frames > 1) return "Muro";
  if (frames === 1) return "Marco";
  return "Pedido";
}

export function toPublicShipment(order: Pick<Order, "number" | "status" | "etaLabel" | "customerName" | "items">): PublicShipment {
  const index = OPEN_STEPS.indexOf(order.status);
  const testOnly = isTestOnlyCart(order.items);
  return {
    number: order.number,
    itemLabel: itemKind(order.items ?? []),
    status: order.status,
    etaLabel: testOnly ? "" : order.etaLabel,
    nameHint: shortName(order.customerName),
    timeline: testOnly ? [] : OPEN_STEPS.map((status, step) => ({
      status,
      label: STATUS_LABEL[status],
      reached: index >= 0 && step <= index,
    })),
  };
}

export const TRACK_WINDOW_MS = 60 * 60 * 1000;
export const TRACK_PHONE_LIMIT = 8;
export const TRACK_IP_LIMIT = 30;

export function trackLimitMessage(events: { phone: string; ip: string; at: number }[], phone: string, ip: string, now: number): string | null {
  const recent = events.filter((event) => now - event.at < TRACK_WINDOW_MS);
  if (recent.filter((event) => event.phone === phone).length >= TRACK_PHONE_LIMIT) {
    return "Demasiados intentos con este celular. Espera un momento e inténtalo otra vez.";
  }
  if (recent.filter((event) => event.ip === ip).length >= TRACK_IP_LIMIT) {
    return "Demasiados intentos desde esta conexión. Espera un momento e inténtalo otra vez.";
  }
  return null;
}
