import { create } from "zustand";
import type { OrderItem } from "./types";

export type CartItem = Omit<OrderItem, "quantity" | "unitPriceCents" | "blurry" | "blurryNote">;

export type CartGift = {
  isGift: boolean;
  to: string;
  message: string;
  from: string;
  hidePrices: boolean;
};

export const emptyCartGift: CartGift = { isGift: false, to: "", message: "", from: "", hidePrices: false };

type CartState = {
  items: CartItem[];
  gift: CartGift;
  ready: boolean;
  hydrate: () => void;
  add: (item: CartItem) => void;
  addMany: (items: CartItem[]) => void;
  remove: (id: string) => void;
  setGift: (gift: CartGift) => void;
  clear: () => void;
};

const KEY = "recuerdo-cart-v1";
const GIFT_KEY = "recuerdo-cart-gift-v1";

function persist(items: CartItem[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
}

function persistGift(gift: CartGift) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(GIFT_KEY, JSON.stringify(gift));
}

function loadGift(): CartGift {
  if (typeof localStorage === "undefined") return emptyCartGift;
  try {
    const raw = localStorage.getItem(GIFT_KEY);
    if (!raw) return emptyCartGift;
    const parsed = JSON.parse(raw) as Partial<CartGift>;
    return {
      isGift: Boolean(parsed.isGift),
      to: String(parsed.to ?? ""),
      message: String(parsed.message ?? ""),
      from: String(parsed.from ?? ""),
      hidePrices: Boolean(parsed.hidePrices),
    };
  } catch {
    return emptyCartGift;
  }
}

function load(): CartItem[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export const useCart = create<CartState>((set, get) => ({
  items: [],
  gift: emptyCartGift,
  ready: false,
  hydrate: () => set({ items: load(), gift: loadGift(), ready: true }),
  add: (item) => {
    const items = [...get().items, item];
    persist(items);
    set({ items });
  },
  addMany: (incoming) => {
    const items = [...get().items, ...incoming];
    persist(items);
    set({ items });
  },
  remove: (id) => {
    const items = get().items.filter((item) => item.id !== id);
    persist(items);
    set({ items });
  },
  setGift: (gift) => {
    persistGift(gift);
    set({ gift });
  },
  clear: () => {
    persist([]);
    persistGift(emptyCartGift);
    set({ items: [], gift: emptyCartGift });
  },
}));

const RECEIPT = "recuerdo-receipt-";
const PENDING_MP = "recuerdo-mp-pending-";
const CHECKOUT_DRAFT = "recuerdo-mp-checkout-draft";

export type PendingMercadoPago = { orderId: string; publicToken: string };

/** Stable sessionStorage key for the cart that already has a Mercado Pago order. */
export function cartPendingKey(items: { id: string }[]): string {
  return items.map((item) => item.id).filter(Boolean).join(".");
}

export function rememberPendingMercadoPago(cartKey: string, order: PendingMercadoPago): void {
  if (typeof sessionStorage === "undefined") return;
  if (!cartKey || !order.orderId || !order.publicToken) return;
  sessionStorage.setItem(`${PENDING_MP}${cartKey}`, JSON.stringify({ orderId: order.orderId, publicToken: order.publicToken }));
}

export function readPendingMercadoPago(cartKey: string): PendingMercadoPago | null {
  if (typeof sessionStorage === "undefined" || !cartKey) return null;
  const raw = sessionStorage.getItem(`${PENDING_MP}${cartKey}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<PendingMercadoPago>;
    if (!parsed.orderId || !parsed.publicToken) return null;
    return { orderId: String(parsed.orderId), publicToken: String(parsed.publicToken) };
  } catch {
    return null;
  }
}

export function clearPendingMercadoPago(cartKey: string): void {
  if (typeof sessionStorage === "undefined" || !cartKey) return;
  sessionStorage.removeItem(`${PENDING_MP}${cartKey}`);
}

export function rememberCheckoutDraft(draft: unknown): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(CHECKOUT_DRAFT, JSON.stringify(draft));
  } catch {
    // A full or blocked sessionStorage still leaves the cart in localStorage.
  }
}

export function readCheckoutDraft<T>(): T | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(CHECKOUT_DRAFT);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function clearCheckoutDraft(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(CHECKOUT_DRAFT);
}

export function rememberReceipt(order: { publicToken: string }): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(`${RECEIPT}${order.publicToken}`, JSON.stringify(order));
}

export function readReceipt<T>(token: string): T | null {
  if (typeof sessionStorage === "undefined") return null;
  const raw = sessionStorage.getItem(`${RECEIPT}${token}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
