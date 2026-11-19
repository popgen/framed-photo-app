import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COLLAGE_MAX_PHOTOS } from "../src/lib/collage";

describe("collage promo", () => {
  it("sells the creator with the real photo cap and keeps the editor accordions", () => {
    const promo = readFileSync("src/components/CollagePromo.tsx", "utf8");
    const crear = readFileSync("src/app/crear.tsx", "utf8");
    const home = readFileSync("src/app/index.tsx", "utf8");
    expect(COLLAGE_MAX_PHOTOS).toBe(12);
    expect(promo).toContain("¡Prueba nuestro creador de collages!");
    expect(promo).toContain(`Junta hasta ${COLLAGE_MAX_PHOTOS} fotos en un solo cuadro`);
    expect(promo).toContain('router.push("/collage")');
    expect(promo).toContain("Haz un collage");
    expect(promo).toContain("Nuevo");
    expect(promo).toContain("minHeight: 48");
    expect(crear).toContain("<CollagePromo />");
    expect(home).toContain("<CollagePromo />");
    expect(crear).toContain('title="Elige tu marco"');
    expect(crear).toContain('headerId={editorHeaderId("photo")}');
    expect(crear).toContain('headerId={editorHeaderId("text")}');
    expect(crear).toContain('headerId={editorHeaderId("voice")}');
    expect(crear).toContain('open={section === "frame"}');
    const promoAt = crear.indexOf("<CollagePromo />");
    const frame = crear.indexOf('title="Elige tu marco"');
    const photo = crear.indexOf('headerId={editorHeaderId("photo")}');
    const text = crear.indexOf('headerId={editorHeaderId("text")}');
    const voice = crear.indexOf('headerId={editorHeaderId("voice")}');
    expect(promoAt).toBeGreaterThan(0);
    expect(promoAt).toBeLessThan(frame);
    expect(frame).toBeLessThan(photo);
    expect(photo).toBeLessThan(text);
    expect(text).toBeLessThan(voice);
  });
});
