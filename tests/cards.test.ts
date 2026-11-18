import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildCardPdf } from "../src/lib/card-pdf";
import { cardsPromoVisible, defaultCampaign } from "../src/lib/campaign";
import { cardSizeById, messageLimits, mmToPt, priceCards, sheetBox } from "../src/lib/cards";
import { emptyOverlay } from "../src/lib/overlay";
import { quote } from "../src/lib/pricing";

describe("christmas cards", () => {
  it("shows the home promo only while the campaign says it is on", () => {
    expect(cardsPromoVisible(new Date("2026-12-18T12:00:00-05:00"), defaultCampaign)).toBe(true);
    expect(cardsPromoVisible(new Date("2026-12-26T00:00:00-05:00"), defaultCampaign)).toBe(false);
    expect(cardsPromoVisible(new Date("2026-12-18T12:00:00-05:00"), { cardsPromo: { ...defaultCampaign.cardsPromo!, enabled: false } })).toBe(false);
  });
  it("prices a single card below the cheapest frame and uses the packs", () => {
    expect(priceCards(1).cents).toBe(1200);
    expect(priceCards(5).cents).toBe(5000);
    expect(priceCards(10).cents).toBe(9000);
    expect(priceCards(6).cents).toBe(6200);
    expect(priceCards(1).cents).toBeLessThan(5900);
  });

  it("keeps frame discounts off card packs", () => {
    const result = quote({
      items: [
        { unitPriceCents: 5900, kind: "frame" },
        { unitPriceCents: 5000, kind: "plain" },
      ],
    });
    expect(result.frameDiscountCents).toBe(0);
    expect(result.subtotalCents).toBe(10900);
    expect(result.totalCents).toBe(10900);
  });

  it("uses exact A6 card stock and a 5×7 shop size", () => {
    const a6 = cardSizeById("a6");
    expect(a6.panelWmm).toBe(105);
    expect(a6.panelHmm).toBe(148);
    expect(sheetBox(a6, false)).toMatchObject({ pageWmm: 315, pageHmm: 148 });
    expect(a6.envelopeWmm).toBe(114);
    expect(a6.envelopeHmm).toBe(162);
    expect(a6.printShop).toBe(false);
    const large = cardSizeById("5x7");
    expect(large.flatWmm).toBe(381);
    expect(large.flatHmm).toBe(177.8);
    expect(large.shopFlag).toBe("Se imprime en un taller, con cartulina grande.");
    expect(sheetBox(a6, true).pageWmm).toBe(315 + 14);
  });

  it("sizes the two messages to the A6 panel", () => {
    const limits = messageLimits(cardSizeById("a6"));
    expect(limits.front).toBe(64);
    expect(limits.inside).toBe(360);
    expect(messageLimits(cardSizeById("5x7")).inside).toBeGreaterThan(limits.inside);
  });

  it("builds a PDF whose first page is the flat card, not a letter sheet", async () => {
    const font = await readFile("node_modules/@expo-google-fonts/pacifico/400Regular/Pacifico_400Regular.ttf");
    const bytes = await buildCardPdf(
      {
        sizeId: "a6",
        quantity: 1,
        envelopeColor: "kraft",
        templateId: "noche",
        frontMessage: emptyOverlay({ text: "Feliz Navidad" }),
        insideMessage: emptyOverlay({ text: "Que la pasen juntos en casa." }),
        photos: {},
        bleed: false,
      },
      { pacifico: font },
    );
    const doc = await PDFDocument.load(bytes);
    const [outside, inside] = doc.getPages();
    expect(outside.getWidth()).toBeCloseTo(mmToPt(315), 1);
    expect(outside.getHeight()).toBeCloseTo(mmToPt(148), 1);
    expect(inside.getWidth()).toBeCloseTo(mmToPt(315), 1);
    expect(doc.getPageCount()).toBe(4);
    const letter = mmToPt(279.4);
    expect(outside.getHeight()).toBeLessThan(letter);
  });
});
