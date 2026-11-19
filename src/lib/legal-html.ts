import { linkParts, type LegalDoc } from "./legal";

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function paragraph(text: string): string {
  const html = linkParts(text)
    .map((part) => (part.href ? `<a href="${escapeHtml(part.href)}">${escapeHtml(part.text)}</a>` : escapeHtml(part.text)))
    .join("");
  return `<p>${html}</p>`;
}

export function legalHtml(doc: LegalDoc): string {
  const sections = doc.sections
    .map((section) => {
      const id = section.id ? ` id="${escapeHtml(section.id)}"` : "";
      return `<section${id}><h2>${escapeHtml(section.heading)}</h2>${section.paragraphs.map(paragraph).join("")}</section>`;
    })
    .join("");
  const english = doc.englishTitle
    ? `<section lang="en"><h2>${escapeHtml(doc.englishTitle)}</h2>${(doc.englishParagraphs ?? []).map(paragraph).join("")}</section>`
    : "";
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(doc.titleTag)}</title>
  <meta name="description" content="${escapeHtml(doc.title)} de Mi Fotito, Lima, Perú." />
  <style>
    body { margin: 0; background: #F6EFE6; color: #241714; font: 17px/1.5 Georgia, "Times New Roman", serif; }
    main { max-width: 40rem; margin: 0 auto; padding: 28px 20px 64px; }
    a { color: #8C2429; }
    h1 { font-size: 2rem; line-height: 1.15; margin: 0 0 8px; }
    h2 { font-size: 1.25rem; margin: 28px 0 8px; }
    p, li { margin: 0 0 12px; }
    .updated, footer, .brand { font-family: system-ui, sans-serif; font-size: 0.95rem; }
    .brand { letter-spacing: 0; font-size: 1.4rem; margin: 0 0 18px; }
    footer { margin-top: 36px; }
  </style>
</head>
<body>
  <main>
    <p class="brand"><a href="https://mifotito.com">Mi Fotito</a></p>
    <h1>${escapeHtml(doc.title)}</h1>
    <p class="updated">Actualizado el ${escapeHtml(doc.updated)}</p>
    ${doc.intro.map(paragraph).join("")}
    ${sections}
    ${english}
    <footer>
      <a href="/privacidad">Política de privacidad</a>
      ·
      <a href="/terminos">Términos y condiciones</a>
    </footer>
  </main>
</body>
</html>
`;
}
