import { describe, expect, it } from "vitest";
import { frames } from "../src/lib/catalog";
import { canPurchaseFrame, inquiryFromSize, retabloMessage, retabloOffer } from "../src/lib/retablo";

describe("retablo inquiry", () => {
  it("is not a frame and cannot be purchased", () => {
    expect(frames.some((frame) => frame.id === retabloOffer.id)).toBe(false);
    expect(canPurchaseFrame(retabloOffer.id)).toBe(false);
    expect(retabloOffer.purchasable).toBe(false);
    expect(canPurchaseFrame("wood-15")).toBe(true);
  });

  it("asks only for the size and keeps that answer for the shop email", () => {
    const row = inquiryFromSize("Mediano, para la sala", "2026-11-18T18:00:00.000Z", "ret_1");
    expect(Object.keys(row).sort()).toEqual(["createdAt", "id", "size", "status"]);
    expect(row).not.toHaveProperty("phone");
    expect(row).not.toHaveProperty("email");
    expect(retabloMessage(row.size)).toContain("Mediano, para la sala");
    expect(retabloMessage(row.size)).toContain("retablo de verdad");
    expect(retabloOffer.question).toBe("¿De qué tamaño lo imaginas?");
  });
});
