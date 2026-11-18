import { describe, expect, it } from "vitest";
import { A5_PANEL_RATIO, FOLD_OPEN_MS, foldPreview } from "../src/lib/card-preview";

describe("card fold preview", () => {
  it("uses an A5 portrait card and a paper fold between 600 and 800 ms", () => {
    expect(A5_PANEL_RATIO).toBeCloseTo(210 / 148.5, 5);
    expect(FOLD_OPEN_MS).toBeGreaterThanOrEqual(600);
    expect(FOLD_OPEN_MS).toBeLessThanOrEqual(800);
    const closed = foldPreview(false, false);
    const open = foldPreview(true, false);
    expect(closed.rotateX).toBe("0deg");
    expect(open.rotateX).toBe("-158deg");
    expect(closed.origin).toBe("top center");
    expect(closed.hint).toBe("Toca para abrir");
    expect(open.hint).toBe("Toca para cerrar");
    expect(open.frontOpacity).toBe(1);
  });

  it("crossfades when motion is reduced", () => {
    const open = foldPreview(true, true);
    const closed = foldPreview(false, true);
    expect(open.rotateX).toBe("0deg");
    expect(open.property).toBe("opacity");
    expect(open.frontOpacity).toBe(0);
    expect(open.insideOpacity).toBe(1);
    expect(closed.frontOpacity).toBe(1);
    expect(closed.insideOpacity).toBe(0);
    expect(open.durationMs).toBeLessThan(FOLD_OPEN_MS);
  });
});