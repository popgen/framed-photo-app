import { create } from "zustand";
import type { OrderItem } from "./types";

export type CartItem = Omit<OrderItem, "quantity" | "unitPriceCents" | "blurry" | "blurryNote">;

type CartState = {
  items: CartItem[];
  ready: boolean;
  hydrate: () => void;
  add: (item: CartItem) => void;
  addMany: (items: CartItem[]) => void;
  remove: (id: string) => void;
  clear: () => void;
};

const KEY = "recuerdo-cart-v1";

function persist(items: CartItem[]) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(items));
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
  ready: false,
  hydrate: () => set({ items: load(), ready: true }),
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
  clear: () => {
    persist([]);
    set({ items: [] });
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
