import { beforeEach, describe, expect, it, vi } from "vitest";
import { sanitizeCartItems, useCart } from "../src/lib/store";

const memory = new Map<string, string>();

vi.stubGlobal("localStorage", {
  getItem: (key: string) => memory.get(key) ?? null,
  setItem: (key: string, value: string) => memory.set(key, value),
  removeItem: (key: string) => memory.delete(key),
});

describe("sanitizeCartItems", () => {
  it("turns missing, null, or non-array data into an empty list", () => {
    expect(sanitizeCartItems(undefined)).toEqual([]);
    expect(sanitizeCartItems(null)).toEqual([]);
    expect(sanitizeCartItems({})).toEqual([]);
    expect(sanitizeCartItems(123)).toEqual([]);
    expect(sanitizeCartItems("x")).toEqual([]);
  });

  it("keeps only objects that have an id", () => {
    const kept = { id: "ci_1", frameId: "wood-15" };
    expect(sanitizeCartItems([kept, null, { frameId: "wood-15" }, "nope"])).toEqual([kept]);
  });
});

describe("cart hydrate", () => {
  beforeEach(() => {
    memory.clear();
    useCart.setState({ items: [], ready: false });
  });

  it("recovers a corrupted localStorage cart and writes back an empty list", () => {
    memory.set("recuerdo-cart-v1", "{}");
    useCart.getState().hydrate();
    expect(useCart.getState().items).toEqual([]);
    expect(memory.get("recuerdo-cart-v1")).toBe("[]");
  });

  it("recovers a null cart and a cart that is not JSON", () => {
    memory.set("recuerdo-cart-v1", "null");
    useCart.getState().hydrate();
    expect(useCart.getState().items).toEqual([]);

    memory.set("recuerdo-cart-v1", "{not json");
    useCart.getState().hydrate();
    expect(useCart.getState().items).toEqual([]);
    expect(memory.get("recuerdo-cart-v1")).toBe("[]");
  });

  it("stays empty after the last item is removed", () => {
    const item = { id: "ci_1", frameId: "wood-15", photoId: "ph", crop: { imageWidth: 1, imageHeight: 1, x: 0, y: 0, width: 1, height: 1 }, orientation: "portrait" as const, dpi: 300, resolutionStatus: "good" as const };
    useCart.getState().add(item as never);
    expect(useCart.getState().items).toHaveLength(1);
    useCart.getState().remove("ci_1");
    expect(useCart.getState().items).toEqual([]);
    expect(JSON.parse(memory.get("recuerdo-cart-v1") || "null")).toEqual([]);
  });
});
