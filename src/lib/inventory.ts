import type { FrameDef } from "./catalog";
import { LOW_STOCK_AT } from "./pricing";

export type SkuNeed = { sku: string; qty: number };

export function expandNeeds(items: { consumes: SkuNeed[]; quantity: number }[]): Record<string, number> {
  const needs: Record<string, number> = {};
  for (const item of items) {
    for (const part of item.consumes) {
      needs[part.sku] = (needs[part.sku] ?? 0) + part.qty * item.quantity;
    }
  }
  return needs;
}

export function applyStock(
  stock: Record<string, number>,
  needs: Record<string, number>,
): { ok: true; next: Record<string, number> } | { ok: false; missing: string[] } {
  const next = { ...stock };
  const missing: string[] = [];
  for (const [sku, qty] of Object.entries(needs)) {
    const have = next[sku] ?? 0;
    if (have < qty) missing.push(sku);
    else next[sku] = have - qty;
  }
  if (missing.length) return { ok: false, missing };
  return { ok: true, next };
}

export function framesAvailable(frame: FrameDef, stock: Record<string, number>): number {
  let min = Number.POSITIVE_INFINITY;
  for (const part of frame.consumes) {
    min = Math.min(min, Math.floor((stock[part.sku] ?? 0) / part.qty));
  }
  return Number.isFinite(min) ? min : 0;
}

export function frameLowStock(frame: FrameDef, stock: Record<string, number>, lowAt: Record<string, number> = {}): boolean {
  const available = framesAvailable(frame, stock);
  if (available <= 0) return false;
  return frame.consumes.some((part) => {
    const qty = stock[part.sku] ?? 0;
    const limit = lowAt[part.sku] ?? LOW_STOCK_AT;
    return qty > 0 && qty <= limit;
  });
}

export function framesWhenStockUnknown(catalog: FrameDef[]): (FrameDef & { available: number; lowStock: boolean; stockUncertain: true })[] {
  return catalog.map((frame) => ({ ...frame, available: 99, lowStock: false, stockUncertain: true }));
}

export function lowStockItems<T extends { sku: string; quantity: number; lowStockAt?: number }>(items: T[], fallback = LOW_STOCK_AT): T[] {
  return items.filter((item) => item.quantity <= (item.lowStockAt ?? fallback));
}
