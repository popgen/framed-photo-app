import { maskPhone, maskStreet } from "./order-number";
import type { Order, OrderStatus } from "./types";

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
