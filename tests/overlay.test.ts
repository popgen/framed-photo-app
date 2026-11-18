import { describe, expect, it } from "vitest";
import { emptyOverlay, parseOverlay, placeOverlay, serializeOverlay } from "../src/lib/overlay";

describe("text overlay", () => {
  it("keeps a phrase with ñ inside the print and snaps to center", () => {
    const placed = placeOverlay(emptyOverlay({ text: "Feliz cumpleaños, Ñaño", x: 0.52, y: 0.48, size: 0.12 }), true);
    expect(placed.text).toContain("ñ");
    expect(placed.x).toBe(0.5);
    expect(placed.y).toBe(0.5);
    expect(placed.x).toBeGreaterThan(0);
    expect(placed.x).toBeLessThan(1);
  });

  it("round-trips and drops an empty message", () => {
    const saved = serializeOverlay(emptyOverlay({ text: "Te amo", color: "#D4A017", rotation: 8 }));
    expect(parseOverlay(saved)?.text).toBe("Te amo");
    expect(parseOverlay(saved)?.color).toBe("#D4A017");
    expect(serializeOverlay(emptyOverlay({ text: "   " }))).toBeNull();
  });

  it("does not let a long line leave the print", () => {
    const placed = placeOverlay(emptyOverlay({ text: "Feliz Navidad para toda la familia", x: 0.02, y: 0.98, size: 0.18 }));
    expect(placed.x).toBeGreaterThan(0.2);
    expect(placed.y).toBeLessThan(0.95);
  });
});
