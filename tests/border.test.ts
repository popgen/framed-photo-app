import { describe, expect, it } from "vitest";
import { borderOf, frameById, frameChips, frames, framesForChip, openingOf, pointInPhoto } from "../src/lib/catalog";
import { mapFrameRow } from "../src/lib/db-map";
import { borderPixels, targetPixels } from "../src/lib/print-size";

describe("asymmetric borders", () => {
  it("keeps the existing frames centered", () => {
    const wood = frameById("wood-15");
    const border = borderOf(wood);
    expect(border.top).toBeCloseTo(border.bottom);
    expect(border.left).toBeCloseTo(1.5);
    const open = openingOf(wood);
    expect(open.y).toBeCloseTo((23 - 20) / 2 / 23);
  });

  it("shows Navidad only when those frames exist and keeps category on a bare row", () => {
    expect(frameChips(frames).map((item) => item.label)).toEqual(["Todos", "Navidad", "Clásicos"]);
    expect(framesForChip(frames, "navidad")).toHaveLength(7);
    expect(frameChips([{ category: undefined }]).map((item) => item.id)).toEqual(["todos", "clasicos"]);
    const row = mapFrameRow({ id: "nieve-celeste", name: "Nieve", size_label: "15×20 cm", tier: "basic", tier_label: "Navidad", price_cents: 7900, print_w_cm: 15, print_h_cm: 20, outer_w_cm: 19.4, outer_h_cm: 26, moulding_cm: 2.2, aspect: "3:4", material: "white", mat: false, stand: true, hanging: false, consumes: [], blurb: "", sort: 11 }, {});
    expect(row.category).toBe("navidad");
    expect(row.style).toBe("traditional");
  });

  it("gives Nieve Celeste a deeper bottom without changing the 15×20 print", () => {
    const frame = frameById("nieve-celeste");
    const border = borderOf(frame);
    expect(frame.style).toBe("traditional");
    expect(border.bottom).toBeGreaterThan(border.top);
    expect(openingOf(frame).y).toBeCloseTo(border.top / frame.outerHcm);
    expect(pointInPhoto(frame, 0.5, 0.5)).toBe(true);
    expect(pointInPhoto(frame, 0.5, 0.97)).toBe(false);
    expect(targetPixels(frame.printWcm, frame.printHcm, "portrait")).toMatchObject({ width: 1772, height: 2362 });
    expect(borderPixels(frame).bottom).toBeGreaterThan(borderPixels(frame).top);
    const navidad = ["nieve-celeste", "acebo-clasico", "estrellas-oro", "retablo-ayacucho", "aguayo-andino", "noche-nevada", "pino-rustico"].map((id) => frameById(id));
    expect(navidad.filter((item) => item.style === "traditional").length).toBeGreaterThanOrEqual(2);
    expect(navidad.filter((item) => item.style === "peruvian").length).toBeGreaterThanOrEqual(2);
  });
});
