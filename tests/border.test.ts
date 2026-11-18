import { describe, expect, it } from "vitest";
import { borderOf, frameById, openingOf, pointInPhoto } from "../src/lib/catalog";
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
