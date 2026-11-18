import { describe, expect, it } from "vitest";
import { assessResolution, centeredCrop, cmToPx, printDpi, targetPixels } from "../src/lib/print-size";

describe("print size", () => {
  it("matches the 300 dpi targets", () => {
    expect(cmToPx(15)).toBe(1772);
    expect(cmToPx(20)).toBe(2362);
    expect(cmToPx(30)).toBe(3543);
    expect(cmToPx(40)).toBe(4724);
    expect(targetPixels(15, 20, "portrait")).toEqual({ width: 1772, height: 2362, wCm: 15, hCm: 20 });
    expect(targetPixels(15, 20, "landscape")).toEqual({ width: 2362, height: 1772, wCm: 20, hCm: 15 });
    expect(targetPixels(30, 40, "portrait")).toEqual({ width: 3543, height: 4724, wCm: 30, hCm: 40 });
    expect(targetPixels(20, 20, "portrait")).toEqual({ width: 2362, height: 2362, wCm: 20, hCm: 20 });
    expect(targetPixels(20, 20, "landscape").width).toBe(2362);
  });

  it("centers a 3:4 crop", () => {
    const tall = centeredCrop(3000, 4000, 3, 4);
    expect(tall).toMatchObject({ x: 0, y: 0, width: 3000, height: 4000 });
    const wide = centeredCrop(4000, 3000, 3, 4);
    expect(wide.width).toBe(2250);
    expect(wide.height).toBe(3000);
    expect(wide.x).toBe(875);
    expect(wide.y).toBe(0);
  });

  it("rates 300 dpi as good, 150 dpi as soft, and suggests a smaller size below that", () => {
    const full = assessResolution({
      cropWidthPx: 1772,
      cropHeightPx: 2362,
      printWcm: 15,
      printHcm: 20,
      orientation: "portrait",
    });
    expect(Math.round(full.dpi)).toBe(300);
    expect(full.status).toBe("good");
    expect(full.message).toBeNull();

    const soft = assessResolution({
      cropWidthPx: 1772,
      cropHeightPx: 2362,
      printWcm: 30,
      printHcm: 40,
      orientation: "portrait",
    });
    expect(Math.round(soft.dpi)).toBe(150);
    expect(soft.status).toBe("soft");
    expect(soft.message).toMatch(/150 dpi/);

    const low = assessResolution({
      cropWidthPx: 1200,
      cropHeightPx: 1600,
      printWcm: 30,
      printHcm: 40,
      orientation: "portrait",
      alternatives: [
        { id: "15", label: "15×20 cm", printWcm: 15, printHcm: 20 },
        { id: "20", label: "20×20 cm", printWcm: 20, printHcm: 20 },
      ],
    });
    expect(low.status).toBe("low");
    expect(low.suggestion?.label).toBe("15×20 cm");
    expect(low.message).toMatch(/15×20 cm/);
    expect(printDpi(1200, 1600, 15, 20)).toBeGreaterThanOrEqual(150);
  });

  it("does not suggest a size that is still under 150 dpi", () => {
    const low = assessResolution({
      cropWidthPx: 700,
      cropHeightPx: 900,
      printWcm: 30,
      printHcm: 40,
      orientation: "portrait",
      alternatives: [{ id: "15", label: "15×20 cm", printWcm: 15, printHcm: 20 }],
    });
    expect(low.status).toBe("low");
    expect(low.suggestion).toBeUndefined();
    expect(low.message).toMatch(/más grande/);
  });
});
