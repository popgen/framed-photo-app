import { describe, expect, it } from "vitest";
import { SELFIE_EDGE, selfieCropSquare, selfieObjectPath, selfieOutputEdge } from "../src/lib/selfie";

describe("selfie crop", () => {
  it("centers a square on a landscape photo and caps the saved edge at 800", () => {
    expect(selfieCropSquare(1600, 900)).toEqual({ sx: 350, sy: 0, size: 900 });
    expect(selfieCropSquare(900, 1600)).toEqual({ sx: 0, sy: 350, size: 900 });
    expect(selfieCropSquare(800, 800)).toEqual({ sx: 0, sy: 0, size: 800 });
    expect(selfieOutputEdge(1600)).toBe(SELFIE_EDGE);
    expect(selfieOutputEdge(420)).toBe(420);
    expect(selfieOutputEdge(0)).toBe(1);
  });

  it("names the file under uploads/selfies", () => {
    expect(selfieObjectPath()).toMatch(/^uploads\/selfies\/[0-9a-f-]{36}\.jpg$/);
  });
});
