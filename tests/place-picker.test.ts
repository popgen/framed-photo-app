import { describe, expect, it } from "vitest";
import { filterPlaces, placePickerLayout } from "../src/lib/place-picker";

const field = { top: 200, bottom: 252, left: 40, width: 320 };

describe("placePickerLayout", () => {
  it("opens the list directly below the field when there is room", () => {
    const layout = placePickerLayout(field, { width: 390, height: 844 });
    expect(layout.placement).toBe("below");
    expect(layout.top).toBe(256);
    expect(layout.left).toBe(40);
    expect(layout.width).toBe(320);
    expect(layout.height).toBe(280);
  });

  it("opens the list above the field when there is no room below", () => {
    const low = { top: 760, bottom: 812, left: 40, width: 320 };
    const layout = placePickerLayout(low, { width: 390, height: 844 });
    expect(layout.placement).toBe("above");
    expect(layout.top + layout.height).toBe(756);
    expect(layout.height).toBeGreaterThan(100);
    expect(layout.top).toBeGreaterThanOrEqual(8);
  });

  it("keeps the list inside a narrow viewport and matches the field width", () => {
    const wide = { top: 100, bottom: 152, left: 20, width: 400 };
    const layout = placePickerLayout(wide, { width: 390, height: 844 });
    expect(layout.left).toBeGreaterThanOrEqual(8);
    expect(layout.left + layout.width).toBeLessThanOrEqual(390 - 8);
  });

  it("uses viewport coordinates so a scrolled page still anchors to the field", () => {
    const mid = { top: 400, bottom: 452, left: 476, width: 414 };
    const layout = placePickerLayout(mid, { width: 1366, height: 900 });
    expect(layout.placement).toBe("below");
    expect(layout.top).toBe(456);
    expect(layout.left).toBe(476);
    expect(layout.width).toBe(414);
    expect(layout.top).toBeLessThan(900);
  });
});

describe("filterPlaces", () => {
  const items = ["Amazonas", "Áncash", "Lima", "Callao", "Arequipa"];

  it("filters without regard to accents or case", () => {
    expect(filterPlaces(items, "ancash")).toEqual(["Áncash"]);
    expect(filterPlaces(items, "LIMA")).toEqual(["Lima"]);
  });

  it("returns every item when the query is empty", () => {
    expect(filterPlaces(items, "  ")).toEqual(items);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterPlaces(items, "xyz")).toEqual([]);
  });
});
