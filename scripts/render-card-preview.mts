import { writeFile, readFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument } from "pdf-lib";
import { buildCardPdf } from "../src/lib/card-pdf.ts";
import { emptyOverlay } from "../src/lib/overlay.ts";

const font = await readFile("node_modules/@expo-google-fonts/pacifico/400Regular/Pacifico_400Regular.ttf");
const dancing = await readFile("node_modules/@expo-google-fonts/dancing-script/600SemiBold/DancingScript_600SemiBold.ttf");
const doc = await PDFDocument.create();
doc.registerFontkit(fontkit);
const embedded = await doc.embedFont(font, { subset: true });
console.log("width", embedded.widthOfTextAtSize("Que la pasen juntos", 20));
const bytes = await buildCardPdf(
  {
    sizeId: "a6",
    quantity: 1,
    envelopeColor: "kraft",
    templateId: "oro",
    frontMessage: { ...emptyOverlay({ text: "Feliz Navidad" }), font: "dancing", color: "#7A1E33", y: 0.55, size: 0.1 },
    insideMessage: { ...emptyOverlay({ text: "Que la pasen juntos en casa." }), font: "pacifico", y: 0.5, color: "#241714", size: 0.08 },
    photos: {},
    bleed: false,
  },
  { pacifico: font, dancing },
);
await writeFile("/tmp/tarjeta-a6.pdf", bytes);
console.log("pdf", bytes.length);
