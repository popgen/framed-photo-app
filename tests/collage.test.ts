import { describe, expect, it } from "vitest";
import { openingOf, frameById } from "../src/lib/catalog";
import {
  COLLAGE_SURCHARGE_CENTS,
  assessCells,
  buildSnapshot,
  cellPixels,
  compositePixels,
  fitCompositeSize,
  framedPriceCents,
  arrangeIndexes,
  cellCentimeters,
  layoutCells,
  mergePhotoCount,
  photoShape,
  previewCount,
  resolveLayout,
  panCrop,
  shuffled,
  suggestTemplate,
  swapped,
  templateById,
  templateFits,
  zoomCrop,
  mulberry32,
  polaroidCard,
  polaroidScatterReport,
  shuffleSeed,
  POLAROID_MIN_VISIBLE,
  CAPTION_BAND,
  type TemplateId,
  type NormRect,
} from "../src/lib/collage";
import { frameStage } from "../src/lib/frame-stage";
import { usesExamplePhoto } from "../src/lib/example-photo";
import type { Orientation } from "../src/lib/print-size";

const TEMPLATES: TemplateId[] = ["lado", "hero", "grid2", "grid23", "grid33", "mosaic", "navidad"];
const ASPECTS = [
  { w: 3, h: 4 },
  { w: 4, h: 3 },
  { w: 1, h: 1 },
];

function overlaps(a: NormRect, b: NormRect) {
  const eps = 1e-4;
  return a.x < b.x + b.w - eps && a.x + a.w > b.x + eps && a.y < b.y + b.h - eps && a.y + a.h > b.y + eps;
}

function inside(cell: NormRect) {
  return cell.x >= -1e-6 && cell.y >= -1e-6 && cell.x + cell.w <= 1 + 1e-6 && cell.y + cell.h <= 1 + 1e-6 && cell.w > 0.02 && cell.h > 0.02;
}

describe("collage layouts", () => {
  it("picks a layout that matches the photo count", () => {
    expect(suggestTemplate(2)).toBe("lado");
    expect(suggestTemplate(3)).toBe("hero");
    expect(suggestTemplate(4)).toBe("grid2");
    expect(suggestTemplate(6)).toBe("grid23");
    expect(suggestTemplate(9)).toBe("grid33");
    expect(suggestTemplate(5)).toBe("mosaic");
    expect(suggestTemplate(12)).toBe("mosaic");
    expect(templateFits("lado", 3)).toBe(false);
    expect(templateFits("navidad", 12)).toBe(true);
    expect(templateFits("mosaic", 12)).toBe(true);
  });

  it("keeps every cell inside the print without overlap", () => {
    for (const templateId of TEMPLATES) {
      for (let count = 2; count <= 12; count += 1) {
        if (!templateFits(templateId, count)) continue;
        for (const aspect of ASPECTS) {
          for (const spacing of ["none", "thin", "thick"] as const) {
            for (const caption of ["", "Navidad 2026 · Familia"]) {
              const cells = layoutCells({ templateId, count, spacing, caption, aspectW: aspect.w, aspectH: aspect.h });
              expect(cells, `${templateId} ${count}`).toHaveLength(count);
              cells.forEach((cell) => expect(inside(cell)).toBe(true));
              for (let i = 0; i < cells.length; i += 1) {
                for (let j = i + 1; j < cells.length; j += 1) expect(overlaps(cells[i], cells[j])).toBe(false);
              }
            }
          }
        }
      }
    }
  });

  it("opens a gap when the border is thick and reserves the caption", () => {
    const tight = layoutCells({ templateId: "lado", count: 2, spacing: "none", caption: "", aspectW: 3, aspectH: 4 });
    const thick = layoutCells({ templateId: "lado", count: 2, spacing: "thick", caption: "", aspectW: 3, aspectH: 4 });
    expect(tight[0].x + tight[0].w).toBeCloseTo(tight[1].x, 5);
    expect(thick[0].x + thick[0].w).toBeLessThan(thick[1].x - 0.01);
    const captioned = layoutCells({ templateId: "grid2", count: 4, spacing: "none", caption: "Familia", aspectW: 3, aspectH: 4 });
    captioned.forEach((cell) => expect(cell.y + cell.h).toBeLessThanOrEqual(0.92));
    const grid = layoutCells({ templateId: "grid2", count: 4, spacing: "none", caption: "", aspectW: 1, aspectH: 1 });
    const area = grid.reduce((sum, cell) => sum + cell.w * cell.h, 0);
    expect(area).toBeCloseTo(1, 5);
  });

  it("insets the Christmas template and turns a wide grid on its side", () => {
    const festive = layoutCells({ templateId: "navidad", count: 4, spacing: "thin", caption: "Navidad 2026", aspectW: 3, aspectH: 4 });
    festive.forEach((cell) => {
      expect(cell.x).toBeGreaterThan(0.04);
      expect(cell.y).toBeGreaterThan(0.04);
      expect(cell.y + cell.h).toBeLessThan(0.9);
    });
    const portrait = layoutCells({ templateId: "grid23", count: 6, spacing: "none", caption: "", aspectW: 3, aspectH: 4 });
    const landscape = layoutCells({ templateId: "grid23", count: 6, spacing: "none", caption: "", aspectW: 4, aspectH: 3 });
    expect(portrait[0].w).toBeCloseTo(0.5, 5);
    expect(portrait[0].h).toBeCloseTo(1 / 3, 5);
    expect(landscape[0].w).toBeCloseTo(1 / 3, 5);
    expect(landscape[0].h).toBeCloseTo(0.5, 5);
  });
});

describe("collage print size", () => {
  it("matches 300 dpi at the frame sizes", () => {
    expect(compositePixels(15, 20, "portrait")).toMatchObject({ width: 1772, height: 2362, wCm: 15, hCm: 20 });
    expect(compositePixels(15, 20, "landscape")).toMatchObject({ width: 2362, height: 1772, wCm: 20, hCm: 15 });
    expect(compositePixels(20, 20, "portrait")).toMatchObject({ width: 2362, height: 2362 });
    expect(compositePixels(30, 40, "portrait")).toMatchObject({ width: 3543, height: 4724, wCm: 30, hCm: 40 });
    expect(compositePixels(30, 40, "landscape")).toMatchObject({ width: 4724, height: 3543, wCm: 40, hCm: 30 });
    expect(fitCompositeSize(3543, 4724)).toEqual({ width: 3543, height: 4724, scale: 1 });
    expect(fitCompositeSize(4724, 3543)).toEqual({ width: 4724, height: 3543, scale: 1 });
  });

  it("shrinks only when the canvas limit is smaller than the print", () => {
    const fitted = fitCompositeSize(4724, 3543, { maxEdge: 4096, maxPixels: 16_000_000 });
    expect(fitted.width).toBeLessThanOrEqual(4096);
    expect(fitted.height).toBeLessThanOrEqual(4096);
    expect(fitted.width / fitted.height).toBeCloseTo(4724 / 3543, 2);
    expect(fitted.scale).toBeLessThan(1);
  });

  it("rates each cell from the centimeters it actually prints", () => {
    const cells = layoutCells({ templateId: "grid2", count: 4, spacing: "none", caption: "", aspectW: 1, aspectH: 1 });
    const sharp = { imageWidth: 2400, imageHeight: 2400, x: 0, y: 0, width: 1181, height: 1181 };
    const good = assessCells([sharp, sharp, sharp, sharp], cells, 20, 20, "portrait");
    expect(good.status).toBe("good");
    expect(Math.round(good.dpi)).toBe(300);
    expect(good.message).toBeNull();
    const softCrop = { ...sharp, width: 700, height: 700 };
    const soft = assessCells([softCrop, sharp, sharp, sharp], cells, 20, 20, "portrait");
    expect(soft.status).toBe("soft");
    expect(soft.message).toMatch(/foto 1/);
    const lowCrop = { ...sharp, width: 250, height: 250 };
    const low = assessCells([sharp, lowCrop, sharp, sharp], cells, 20, 20, "portrait");
    expect(low.status).toBe("low");
    expect(low.message).toMatch(/foto 2/);
    expect(assessCells([], [], 20, 20, "portrait").message).toBeNull();
    const px = cellPixels(cells[0], 2362, 2362);
    expect(px.w).toBeCloseTo(1181, 0);
    expect(px.h).toBeCloseTo(1181, 0);
  });

  it("keeps pan and zoom inside the photo", () => {
    const crop = { imageWidth: 2000, imageHeight: 3000, x: 200, y: 400, width: 1000, height: 1500 };
    const closer = zoomCrop(crop, 1.4);
    expect(closer.width).toBeLessThan(crop.width);
    expect(closer.width / closer.height).toBeCloseTo(crop.width / crop.height, 5);
    expect(closer.x).toBeGreaterThanOrEqual(0);
    expect(closer.y).toBeGreaterThanOrEqual(0);
    expect(closer.x + closer.width).toBeLessThanOrEqual(2000);
    const panned = panCrop(crop, 500, -400, 200, 300);
    expect(panned.x).toBeGreaterThanOrEqual(0);
    expect(panned.y + panned.height).toBeLessThanOrEqual(3000);
    expect(panned.width).toBe(crop.width);
  });
});

describe("collage order", () => {
  it("charges the frame price while the surcharge stays at zero", () => {
    expect(COLLAGE_SURCHARGE_CENTS).toBe(0);
    expect(framedPriceCents(10900, true)).toBe(10900);
    expect(framedPriceCents(5900, false)).toBe(5900);
    const snapshot = buildSnapshot({
      templateId: "grid2",
      spacing: "thin",
      background: "cream",
      rounded: true,
      caption: "Navidad 2026 · Familia",
      frameId: "wood-15",
      orientation: "portrait" satisfies Orientation,
      printWcm: 15,
      printHcm: 20,
      photos: [0, 1, 2, 3].map((index) => ({
        photoId: `ph_${index}`,
        width: 2400,
        height: 3000,
        crop: { imageWidth: 2400, imageHeight: 3000, x: 100, y: 50, width: 1800, height: 2400 },
      })),
    });
    expect(snapshot.templateName).toBe("Cuadrícula de 4");
    expect(snapshot.sources).toHaveLength(4);
    expect(snapshot.surchargeCents).toBe(0);
    expect(snapshot.sources[0].dpi).toBeGreaterThan(150);
  });

  it("adapts a layout that cannot hold the photos and keeps one that can", () => {
    expect(previewCount("grid2")).toBe(4);
    expect(previewCount("lado")).toBe(2);
    expect(previewCount("mosaic")).toBe(5);
    expect(previewCount("navidad")).toBe(4);
    const mismatch = resolveLayout("lado", 12);
    expect(mismatch.id).toBe("mosaic");
    expect(mismatch.notice).toBe("Con 12 fotos, Lado a lado no entra. Las acomodamos en Mosaico.");
    expect(resolveLayout("grid2", 4)).toEqual({ id: "grid2", notice: null });
    expect(resolveLayout("navidad", 7).id).toBe("navidad");
    expect(resolveLayout("hero", 1)).toEqual({ id: "hero", notice: null });
  });

  it("puts portrait photos in tall cells and landscape photos in wide cells", () => {
    expect(photoShape(800, 1400)).toBe("tall");
    expect(photoShape(1600, 900)).toBe("wide");
    expect(photoShape(1000, 1000)).toBe("square");
    const photos = [
      { width: 1600, height: 900 },
      { width: 900, height: 1600 },
      { width: 800, height: 1500 },
    ];
    const cells = [
      { wCm: 8, hCm: 16 },
      { wCm: 16, hCm: 8 },
      { wCm: 7, hCm: 14 },
    ];
    expect(arrangeIndexes(photos, cells)).toEqual([1, 0, 2]);
    const grid = layoutCells({ templateId: "hero", count: 3, spacing: "none", caption: "", aspectW: 3, aspectH: 4 });
    const placed = arrangeIndexes(photos, grid.map((cell) => cellCentimeters(cell, 15, 20, "portrait")));
    expect(placed).toHaveLength(3);
    expect(new Set(placed).size).toBe(3);
    const heroTop = cellCentimeters(grid[0], 15, 20, "portrait");
    if (photoShape(heroTop.wCm, heroTop.hCm) === "wide") expect(placed[0]).toBe(0);
  });

  it("blocks example photos inside a collage and caps the count at 12", () => {
    expect(usesExamplePhoto({ photoId: "ph_comp", collage: { sources: [{ photoId: "asset:sample" }] } })).toBe(true);
    expect(usesExamplePhoto({ photoId: "ph_comp", collage: { sources: [{ photoId: "ph_1" }, { photoId: "ph_2" }] } })).toBe(false);
    expect(mergePhotoCount(10, 4)).toEqual({ take: 2, note: "Puedes juntar hasta 12 fotos. Dejamos las primeras que entran." });
    expect(mergePhotoCount(12, 1).take).toBe(0);
    expect(swapped(["a", "b", "c"], 0, 2)).toEqual(["c", "b", "a"]);
    const mixed = shuffled([1, 2, 3, 4], () => 0);
    expect([...mixed].sort()).toEqual([1, 2, 3, 4]);
    expect(mixed).not.toEqual([1, 2, 3, 4]);
  });

  it("places the landscape opening inside the frame", () => {
    const frame = frameById("wood-15");
    const open = openingOf(frame);
    const portrait = frameStage(frame, "portrait", 180);
    expect(portrait.opening.x).toBeCloseTo(open.x * 180, 4);
    expect(portrait.opening.h).toBeGreaterThan(portrait.opening.w);
    const landscape = frameStage(frame, "landscape", 180);
    expect(landscape.opening.w).toBeGreaterThan(landscape.opening.h);
    expect(landscape.opening.w / landscape.opening.h).toBeCloseTo(20 / 15, 1);
    expect(landscape.opening.x).toBeGreaterThanOrEqual(-0.5);
    expect(landscape.opening.y).toBeGreaterThanOrEqual(-0.5);
    expect(landscape.opening.x + landscape.opening.w).toBeLessThanOrEqual(landscape.boxW + 0.5);
    expect(landscape.opening.y + landscape.opening.h).toBeLessThanOrEqual(landscape.boxH + 0.5);
    const square = frameStage(frameById("square-black-20"), "landscape", 200);
    expect(square.landscape).toBe(false);
    expect(compositePixels(square ? 20 : 20, 20, "landscape").width).toBe(2362);
  });
});

describe("polaroid collage", () => {
  const aspects = [
    { w: 15, h: 20 },
    { w: 20, h: 15 },
    { w: 20, h: 20 },
  ];

  function place(count: number, seed: number, aspect = aspects[0], caption = "") {
    return layoutCells({
      templateId: "polaroids",
      count,
      spacing: "thin",
      caption,
      aspectW: aspect.w,
      aspectH: aspect.h,
      seed,
    });
  }

  it("is a selectable layout for 1 to 12 photos", () => {
    expect(templateById("polaroids").name).toBe("Polaroids sobre la mesa");
    expect(templateFits("polaroids", 1)).toBe(true);
    expect(templateFits("polaroids", 12)).toBe(true);
    expect(templateFits("polaroids", 0)).toBe(false);
    expect(previewCount("polaroids")).toBe(5);
    expect(resolveLayout("polaroids", 1)).toEqual({ id: "polaroids", notice: null });
    expect(resolveLayout("polaroids", 8).id).toBe("polaroids");
    expect(suggestTemplate(4)).toBe("grid2");
  });

  it("keeps the same scatter for a seed and a new scatter for another", () => {
    const first = place(6, 42);
    expect(place(6, 42)).toEqual(first);
    expect(place(6, 43)).not.toEqual(first);
    const signatures = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => place(7, seed).map((cell) => `${cell.x.toFixed(3)}:${cell.rotation?.toFixed(2)}`).join("|"));
    expect(new Set(signatures).size).toBeGreaterThan(5);
  });

  it("fills the frame, keeps each face mostly visible, and tilts only slightly", () => {
    const seeds = [1, 7, 11, 42, 99, 256, 1024, 4096, 99991];
    let overlapped = 0;
    for (const aspect of aspects) {
      for (let count = 1; count <= 12; count += 1) {
        for (const seed of seeds) {
          for (const caption of ["", "Familia 2026"]) {
            const cells = place(count, seed, aspect, caption);
            expect(cells, `${count} ${seed}`).toHaveLength(count);
            const yMax = caption ? aspect.h * (1 - CAPTION_BAND) : aspect.h;
            const report = polaroidScatterReport(cells, aspect.w, aspect.h, yMax);
            expect(report.anchored, `${count} seed ${seed}`).toBe(true);
            expect(report.background, `${count} seed ${seed} ${caption}`).toBeLessThanOrEqual(0.42);
            expect(report.minVisible, `${count} seed ${seed} ${caption} ${aspect.w}x${aspect.h}`).toBeGreaterThanOrEqual(0.5);
            if (!caption && count === 1) expect(report.background, `una foto ${seed}`).toBeLessThanOrEqual(0.24);
            if (!caption && seed === 42 && aspect.w === 15 && (count === 1 || count === 6 || count === 12)) {
              expect(report.background, `${count} fotos`).toBeLessThanOrEqual(0.08);
            }
            cells.forEach((cell) => {
              expect(cell.rotation ?? 0).toBeGreaterThanOrEqual(-8);
              expect(cell.rotation ?? 0).toBeLessThanOrEqual(8);
              const card = polaroidCard(cell, aspect.w, aspect.h);
              const photoW = cell.w * aspect.w;
              const side = (cell.x - card.x) * aspect.w;
              const top = (cell.y - card.y) * aspect.h;
              const bottom = (card.y + card.h - (cell.y + cell.h)) * aspect.h;
              expect(bottom).toBeGreaterThan(side * 2);
              expect(bottom).toBeGreaterThan(top * 2);
              expect(side).toBeCloseTo(POLAROID_SIDE(photoW), 5);
            });
            if (count >= 4 && report.overlaps) overlapped += 1;
          }
        }
      }
    }
    expect(overlapped).toBeGreaterThan(20);
    expect(POLAROID_MIN_VISIBLE).toBeGreaterThanOrEqual(0.58);
    expect(POLAROID_MIN_VISIBLE).toBeLessThanOrEqual(0.7);
  });

  it("saves the seed so the print repeats the preview", () => {
    const photos = [0, 1, 2, 3, 4].map((index) => ({
      photoId: `ph_${index}`,
      width: 2400,
      height: 3000,
      crop: { imageWidth: 2400, imageHeight: 3000, x: 200, y: 400, width: 1800, height: 1800 },
    }));
    const snapshot = buildSnapshot({
      templateId: "polaroids",
      spacing: "thin",
      background: "desk",
      rounded: false,
      caption: "",
      frameId: "wood-15",
      orientation: "portrait",
      printWcm: 15,
      printHcm: 20,
      photos,
      layoutSeed: 42,
    });
    expect(snapshot.templateName).toBe("Polaroids sobre la mesa");
    expect(snapshot.layoutSeed).toBe(42);
    expect(snapshot.background).toBe("desk");
    const again = place(photos.length, snapshot.layoutSeed ?? 0, { w: 15, h: 20 });
    snapshot.sources.forEach((source, index) => {
      expect(source.cell).toEqual(again[index]);
      expect(source.rotation).toBe(again[index].rotation);
    });
    const orderA = shuffled(["a", "b", "c", "d", "e", "f"], mulberry32(shuffleSeed(11)));
    const orderB = shuffled(["a", "b", "c", "d", "e", "f"], mulberry32(shuffleSeed(29)));
    expect(orderA).not.toEqual(orderB);
    expect(shuffled(["a", "b", "c", "d", "e", "f"], mulberry32(shuffleSeed(11)))).toEqual(orderA);
  });
});

function POLAROID_SIDE(photoW: number) {
  return 0.065 * photoW;
}
