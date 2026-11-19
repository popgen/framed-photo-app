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
