import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildCardPdf } from "../src/lib/card-pdf";
import { cardsPromoVisible, defaultCampaign } from "../src/lib/campaign";
import { CARD_TEXT_MIN_PT, layoutCardText } from "../src/lib/card-text";
import { cardMessageError, cardOrderLine, cardSheetCopy, cardSizeById, messageLimits, mmToPt, priceCards, sheetBox } from "../src/lib/cards";
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
    expect(sheetBox(a6, false)).toMatchObject({ pageWmm: 105, pageHmm: 296 });
    expect(a6.envelopeWmm).toBe(114);
    expect(a6.envelopeHmm).toBe(162);
    expect(a6.printShop).toBe(false);
    expect(cardSheetCopy(a6)).toContain("105×296");
    expect(cardSheetCopy(a6)).toContain("A4");
    const large = cardSizeById("5x7");
    expect(large.flatWmm).toBe(127);
    expect(large.flatHmm).toBe(355.6);
    expect(large.panelWmm).toBe(127);
    expect(large.panelHmm).toBe(177.8);
    expect(large.shopFlag).toBe("Se imprime en un taller, con cartulina grande.");
    expect(cardOrderLine({ sizeId: "5x7" })).toContain("5×14");
    expect(sheetBox(a6, true).pageWmm).toBe(105 + 14);
    expect(sheetBox(a6, true).pageHmm).toBe(296 + 14);
  });

  it("lets both panels hold a 300 character message", () => {
    expect(messageLimits(cardSizeById("a6"))).toEqual({ front: 300, inside: 300 });
    expect(messageLimits(cardSizeById("5x7"))).toEqual({ front: 300, inside: 300 });
    const sample = cardParagraph(300);
    expect(cardMessageError([{ card: { insideMessage: { text: sample } } }])).toBeNull();
    expect(cardMessageError([{ card: { frontMessage: { text: `${sample} extra` } } }])).toMatch(/300/);
  });

  it("fits 300 characters on the A6 inside panel at a readable size", async () => {
    const fontkit = await import("@pdf-lib/fontkit");
    const { PDFDocument } = await import("pdf-lib");
    const fontBytes = await readFile("node_modules/@expo-google-fonts/pacifico/400Regular/Pacifico_400Regular.ttf");
    const doc = await PDFDocument.create();
    doc.registerFontkit(fontkit.default);
    const font = await doc.embedFont(fontBytes);
    const sample = cardParagraph(300);
    const boxW = mmToPt(105);
    const boxH = mmToPt(148);
    const fitted = layoutCardText(sample, boxW, boxH, (line, size) => font.widthOfTextAtSize(line || " ", size), boxH * 0.12, CARD_TEXT_MIN_PT);
    expect([...sample].length).toBe(300);
    expect(fitted.size).toBeGreaterThanOrEqual(CARD_TEXT_MIN_PT);
    expect(fitted.lines.length * fitted.leading).toBeLessThanOrEqual(boxH * 0.86 + 0.5);
    expect(fitted.lines.every((line) => font.widthOfTextAtSize(line || " ", fitted.size) <= boxW * 0.84 + 0.5)).toBe(true);
    const bytes = await buildCardPdf(
      {
        sizeId: "a6",
        quantity: 1,
        envelopeColor: "kraft",
        templateId: "noche",
        frontMessage: null,
        insideMessage: emptyOverlay({ text: sample, color: "#241714", y: 0.5 }),
        photos: {},
        bleed: false,
      },
      { pacifico: fontBytes },
    );
    const { writeFile } = await import("node:fs/promises");
    await writeFile("/tmp/tarjeta-300.pdf", bytes);
    const loaded = await PDFDocument.load(bytes);
    expect(loaded.getPageCount()).toBe(4);
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
    const [sheet, back] = doc.getPages();
    expect(sheet.getWidth()).toBeCloseTo(mmToPt(105), 1);
    expect(sheet.getHeight()).toBeCloseTo(mmToPt(296), 1);
    expect(back.getWidth()).toBeCloseTo(mmToPt(105), 1);
    expect(back.getHeight()).toBeCloseTo(mmToPt(148), 1);
    expect(doc.getPageCount()).toBe(4);
    expect(doc.getSubject()).toContain("105×296");
    const a4 = mmToPt(297);
    expect(sheet.getHeight()).toBeLessThan(a4);
    expect(sheet.getWidth()).toBeLessThan(mmToPt(210));
  });

  it("still prints a stored card that used the older photo keys", async () => {
    const font = await readFile("node_modules/@expo-google-fonts/pacifico/400Regular/Pacifico_400Regular.ttf");
    const bytes = await buildCardPdf(
      {
        sizeId: "a6",
        quantity: 1,
        envelopeColor: "white",
        templateId: "oro",
        frontMessage: null,
        insideMessage: null,
        photos: { front: "old-front", back: "old-back", flap: "old-flap", insideLeft: "old-left", insideCenter: "old-center" },
        bleed: false,
      },
      { pacifico: font },
    );
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(4);
    expect(doc.getPages()[0].getHeight()).toBeGreaterThan(doc.getPages()[0].getWidth());
  });
});

function cardParagraph(length: number): string {
  const sentence = "Que esta Navidad los encuentre juntos, con una mesa larga y tiempo para contarse la vida. ";
  let sample = "";
  while ([...sample].length < length) sample += sentence;
  return [...sample].slice(0, length).join("");
}
