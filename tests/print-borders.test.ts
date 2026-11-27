import { describe, expect, it } from "vitest";
import { frameById, frames, isOfferedFrame, offeredFrames, OFFERED_FRAME_IDS } from "../src/lib/catalog";
import { findPrintBorder, normalizePrintBorder, PRINT_BORDERS, PRINT_BORDER_CENTS, printBorderDataUri, printBorderLabel, printBorderSvg } from "../src/lib/print-borders";
import { offeredWalls } from "../src/lib/walls";
import { mapItemRow } from "../src/lib/db-map";

describe("frames on sale", () => {
  it("offers only white, black and natural wood, in that order, at their prices", () => {
    const offered = offeredFrames(frames);
    expect(offered.map((frame) => frame.id)).toEqual(["thin-white-15", "thin-black-15", "wood-15"]);
    expect(offered.map((frame) => frame.name)).toEqual(["Blanco delgado", "Negro delgado", "Madera natural"]);
    expect(offered.every((frame) => frame.priceCents === 5900)).toBe(true);
    expect([...OFFERED_FRAME_IDS]).toEqual(offered.map((frame) => frame.id));
  });

  it("keeps retired frames resolvable for old orders and carts", () => {
    for (const id of ["acebo-clasico", "nieve-celeste", "black-30", "wood-mat", "square-black-20", "thin-gold-15"]) {
      expect(() => frameById(id)).not.toThrow();
      expect(frameById(id).retired).toBe(true);
      expect(isOfferedFrame(id)).toBe(false);
    }
    expect(isOfferedFrame("nope")).toBe(false);
    expect(offeredFrames([{ id: "nope" }, { id: "wood-15" }])).toEqual([{ id: "wood-15" }]);
  });

  it("only offers wall sets made of frames on sale", () => {
    expect(offeredWalls.map((wall) => wall.id)).toEqual(["trio"]);
    expect(offeredWalls[0].finishes.map((finish) => finish.id)).toEqual(["wood", "black", "white"]);
  });
});

describe("printed Christmas borders", () => {
  it("has six distinct, named designs and costs nothing extra", () => {
    expect(PRINT_BORDERS).toHaveLength(6);
    expect(new Set(PRINT_BORDERS.map((item) => item.name)).size).toBe(6);
    expect(PRINT_BORDER_CENTS).toBe(0);
    const svgs = PRINT_BORDERS.map((item) => printBorderSvg(item.id, 1772, 2362));
    expect(new Set(svgs).size).toBe(6);
  });

  it("renders a print-size SVG with the exact pixel size", () => {
    for (const item of PRINT_BORDERS) {
      const svg = printBorderSvg(item.id, 1772, 2362)!;
      expect(svg).toContain('width="1772"');
      expect(svg).toContain('height="2362"');
      expect(svg).not.toMatch(/NaN|undefined|Infinity/);
      const wide = printBorderSvg(item.id, 2362, 1772)!;
      expect(wide).toContain('viewBox="0 0 1333 1000"');
    }
    expect(printBorderDataUri("acebo", 60, 80)).toMatch(/^data:image\/svg\+xml/);
  });

  it("rejects unknown ids so orders only store real designs", () => {
    expect(normalizePrintBorder("acebo")).toBe("acebo");
    expect(normalizePrintBorder("hack<script>")).toBeNull();
    expect(normalizePrintBorder(null)).toBeNull();
    expect(printBorderSvg("nope", 10, 10)).toBeNull();
    expect(findPrintBorder(undefined)).toBeUndefined();
    expect(printBorderLabel("andino")).toBe("Marco navideño impreso: Andino");
  });

  it("reads the border back from an order_items row", () => {
    expect(mapItemRow({ id: "x", frame_id: "wood-15", print_border: "copos" }).printBorder).toBe("copos");
    expect(mapItemRow({ id: "x", frame_id: "wood-15" }).printBorder).toBeNull();
  });
});
