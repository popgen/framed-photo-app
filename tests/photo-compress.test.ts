import { describe, expect, it } from "vitest";
import { buildCompressSteps, longestPrintEdge, MAX_BUCKET_BYTES, MAX_UPLOAD_BYTES, pickCompressed } from "../src/lib/photo-compress";

describe("photo upload size", () => {
  it("keeps a file that is already under 8 MB", () => {
    expect(pickCompressed(MAX_UPLOAD_BYTES, [999])).toEqual({ action: "original" });
    expect(pickCompressed(MAX_UPLOAD_BYTES - 1, [])).toEqual({ action: "original" });
  });

  it("tries JPEG quality at full size before shrinking, and stops at the 200 DPI floor", () => {
    const steps = buildCompressSteps({ width: 8000, height: 6000, printWcm: 15, printHcm: 20 });
    expect(steps.slice(0, 4)).toEqual([
      { quality: 0.95, longEdge: 8000 },
      { quality: 0.9, longEdge: 8000 },
      { quality: 0.85, longEdge: 8000 },
      { quality: 0.8, longEdge: 8000 },
    ]);
    const edge300 = longestPrintEdge(15, 20, 300);
    const edge200 = longestPrintEdge(15, 20, 200);
    expect(steps.some((step) => step.longEdge === edge300)).toBe(true);
    expect(Math.min(...steps.map((step) => step.longEdge))).toBe(edge200);
    expect(steps.every((step, index) => index === 0 || step.longEdge <= steps[index - 1].longEdge)).toBe(true);
  });

  it("uses the first encode under 8 MB, or the 10 MB floor attempt, or rejects", () => {
    expect(pickCompressed(9_000_000, [8_500_000, 7_000_000])).toEqual({ action: "attempt", index: 1 });
    expect(pickCompressed(12_000_000, [11_000_000, 9_000_000])).toEqual({ action: "attempt", index: 1 });
    expect(pickCompressed(20_000_000, [MAX_BUCKET_BYTES + 1])).toEqual({ action: "reject" });
  });
});