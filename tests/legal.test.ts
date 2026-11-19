import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { legalHtml } from "../src/lib/legal-html";
import { privacyDoc, termsDoc } from "../src/lib/legal";

const REQUIRED = [
  "pedidos@mifotito.com",
  "photospicker.mediaitems.readonly",
  "Limited Use",
  "30 días",
  "Ley N.° 29733",
  "eliminar-datos",
  "18 de noviembre de 2026",
  "Mi Fotito",
  "Lima",
];

describe("legal pages", () => {
  it("publishes the privacy page as static html with the same text", () => {
    const html = legalHtml(privacyDoc);
    expect(readFileSync("public/privacidad/index.html", "utf8")).toBe(html);
    for (const phrase of REQUIRED) expect(html).toContain(phrase);
    expect(html).toContain('id="eliminar-datos"');
    expect(html).toContain("Política de privacidad — Mi Fotito</title>");
    expect(html).toContain('lang="en"');
    expect(html).toContain("Google API Services User Data Policy");
  });

  it("publishes the terms page as static html", () => {
    const html = legalHtml(termsDoc);
    expect(readFileSync("public/terminos/index.html", "utf8")).toBe(html);
    expect(html).toContain("18 de diciembre");
    expect(html).toContain("15 de diciembre");
    expect(html).toContain("/reclamo");
    expect(html).toContain("soles");
    expect(html).toContain("Términos y condiciones — Mi Fotito</title>");
  });

  it("copies the legal pages into the web export", () => {
    const pkg = readFileSync("package.json", "utf8");
    const script = readFileSync("scripts/publish-web.mjs", "utf8");
    expect(pkg).toContain("scripts/publish-web.mjs");
    expect(script).toContain('cpSync("public", "dist"');
    expect(script).toContain('href="/privacidad"');
  });

  it("schedules the photo purge without a public path", () => {
    const source = readFileSync("netlify/functions/purge-photos.mjs", "utf8");
    expect(source).toContain('schedule: "0 8 * * *"');
    expect(source).not.toMatch(/config = \{[^}]*\bpath\b/);
  });
});
