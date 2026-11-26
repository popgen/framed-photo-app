import { describe, expect, it } from "vitest";
import { cartQuoteLines } from "../src/lib/cart-lines";
import { quote } from "../src/lib/pricing";
import { priceCards } from "../src/lib/cards";

const base = { frameId: "wood-15" };

describe("cartQuoteLines", () => {
  it("prices a card without looking its card-a4 id up as a frame", () => {
    const lines = cartQuoteLines([{ frameId: "card-a4", card: { quantity: 1 } }]);
    expect(lines).toEqual([{ unitPriceCents: priceCards(1).cents, quantity: 1, kind: "plain" }]);
    expect(quote({ items: lines }).totalCents).toBe(priceCards(1).cents);
  });

  it("prices a framed photo and adds the voice note on top", () => {
    const lines = cartQuoteLines([{ ...base, voice: { addonCents: 500 } }]);
    expect(lines.map((line) => line.kind)).toEqual(["frame", "plain"]);
    expect(quote({ items: lines }).totalCents).toBe(5900 + 500);
  });

  it("prices the test product at S/ 5", () => {
    expect(cartQuoteLines([{ frameId: "producto-prueba", testProduct: true }])).toEqual([{ unitPriceCents: 500, quantity: 1, kind: "plain" }]);
  });

  it("prices a card next to a frame", () => {
    const lines = cartQuoteLines([base, { frameId: "card-a4", card: { quantity: 1 } }]);
    expect(lines).toHaveLength(2);
  });
});
