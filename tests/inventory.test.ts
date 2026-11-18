import { describe, expect, it } from "vitest";
import { frameById } from "../src/lib/catalog";
import { serverStockChecksEnabled, stockChecksEnabled } from "../src/lib/env";
import { applyStock, expandNeeds, frameLowStock, framesAvailable, lowStockItems } from "../src/lib/inventory";
import { evaluateOrder } from "../src/lib/server-order";

describe("inventory", () => {
  it("shares the 30x40 body between the wall frame and the matted premium", () => {
    const needs = expandNeeds([
      { consumes: frameById("black-mat").consumes, quantity: 1 },
      { consumes: frameById("black-30").consumes, quantity: 1 },
    ]);
    expect(needs["body-30-black"]).toBe(2);
    expect(needs["mat-white"]).toBe(1);
    const ok = applyStock({ "body-30-black": 2, "mat-white": 1 }, needs);
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.next["body-30-black"]).toBe(0);
      expect(ok.next["mat-white"]).toBe(0);
    }
    const missing = applyStock({ "body-30-black": 1, "mat-white": 5 }, needs);
    expect(missing.ok).toBe(false);
  });

  it("alerts at 5 units and limits a frame by its scarcest part", () => {
    expect(lowStockItems([{ sku: "body-15-gold", quantity: 4, lowStockAt: 5 }]).map((item) => item.sku)).toEqual(["body-15-gold"]);
    expect(lowStockItems([{ sku: "body-15-black", quantity: 6, lowStockAt: 5 }])).toEqual([]);
    const stock = { "body-30-wood": 3, "mat-white": 1 };
    expect(framesAvailable(frameById("wood-mat"), stock)).toBe(1);
    expect(framesAvailable(frameById("wood-30"), stock)).toBe(3);
  });

  it("calls a frame low when a part is above zero and at the low-stock line", () => {
    const gold = frameById("thin-gold-15");
    const stock = { "body-15-gold": 4 };
    const lowAt = { "body-15-gold": 5 };
    expect(framesAvailable(gold, stock)).toBe(4);
    expect(frameLowStock(gold, stock, lowAt)).toBe(true);
    expect(frameLowStock(gold, { "body-15-gold": 0 }, lowAt)).toBe(false);
    expect(frameLowStock(frameById("wood-15"), { "body-15-wood": 18 }, { "body-15-wood": 5 })).toBe(false);
  });

  it("keeps stock checks off unless the flag is explicitly on", () => {
    const previousPublic = process.env.EXPO_PUBLIC_STOCK_CHECKS_ENABLED;
    const previousServer = process.env.STOCK_CHECKS_ENABLED;
    delete process.env.EXPO_PUBLIC_STOCK_CHECKS_ENABLED;
    delete process.env.STOCK_CHECKS_ENABLED;
    expect(stockChecksEnabled()).toBe(false);
    expect(serverStockChecksEnabled()).toBe(false);
    process.env.EXPO_PUBLIC_STOCK_CHECKS_ENABLED = "true";
    process.env.STOCK_CHECKS_ENABLED = "true";
    expect(stockChecksEnabled()).toBe(true);
    expect(serverStockChecksEnabled()).toBe(true);
    if (previousPublic === undefined) delete process.env.EXPO_PUBLIC_STOCK_CHECKS_ENABLED;
    else process.env.EXPO_PUBLIC_STOCK_CHECKS_ENABLED = previousPublic;
    if (previousServer === undefined) delete process.env.STOCK_CHECKS_ENABLED;
    else process.env.STOCK_CHECKS_ENABLED = previousServer;

    const input = {
      items: [{
        frameId: "thin-gold-15",
        photoId: "p",
        crop: { imageWidth: 100, imageHeight: 100, x: 0, y: 0, width: 10, height: 10 },
        orientation: "portrait" as const,
        dpi: 300,
        resolutionStatus: "good" as const,
      }],
      customerName: "Ana",
      phone: "987654321",
      giftWrap: false,
      addressLine: "Calle 1",
      district: "Miraflores",
      city: "Lima",
      department: "Lima",
      province: "Lima",
      useCredit: false,
      taxIdSkipped: true,
    };
    expect(evaluateOrder(input, { promos: [], stock: {}, enforceStock: true }).error).toMatch(/stock/i);
    expect(evaluateOrder(input, { promos: [], stock: {}, enforceStock: false }).error).toBeUndefined();
  });
});
