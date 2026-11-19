import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { applySeoToHtml, pageForPath, robotsTxt, sitemapXml, spaShellPages } from "../src/lib/seo.ts";

// Expo's single-page export does not copy public/ and does not use src/app/+html.tsx.
// This step writes the files Netlify actually serves: robots, sitemap, and one HTML
// document per public route so the title and meta tags are in the response body.
writeFileSync("public/robots.txt", robotsTxt());
writeFileSync("public/sitemap.xml", sitemapXml());

const indexPath = "dist/index.html";
let base = readFileSync(indexPath, "utf8");
const noscript =
  '<noscript><div style="max-width:640px;margin:0 auto;padding:24px;font-family:Georgia,serif;color:#241714"><p style="font-size:32px">Mi Fotito</p><p>Marcos impresos en Lima, Perú.</p><p><a href="/privacidad">Política de privacidad</a> · <a href="/terminos">Términos y condiciones</a></p></div></noscript>';
if (base.includes("You need to enable JavaScript")) {
  base = base.replace(/<noscript>[\s\S]*?<\/noscript>/, noscript);
} else if (!base.includes('href="/privacidad"')) {
  base = base.replace("</body>", `${noscript}</body>`);
}

cpSync("public", "dist", { recursive: true });

const home = pageForPath("/");
if (!home) throw new Error("Falta la página de inicio en el SEO.");
const homeHtml = applySeoToHtml(base, home);
writeFileSync(indexPath, homeHtml);
assertHead(indexPath, home);

for (const page of spaShellPages()) {
  if (page.path === "/") continue;
  // A file at /crear.html is what Netlify serves for /crear. A directory
  // index would 301 /crear to /crear/, and redirect rules cannot remove that slash.
  const file = join("dist", `${page.path.slice(1)}.html`);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, applySeoToHtml(base, page));
  assertHead(file, page);
}

function assertHead(file, page) {
  const html = readFileSync(file, "utf8");
  const needles = [
    '<html lang="es"',
    `<title data-mifotito="title">${page.title}</title>`,
    `name="description" content="${page.description}"`,
    'name="keywords"',
    `rel="canonical" href="${page.canonical}"`,
    'property="og:type" content="website"',
    'property="og:site_name" content="Mi Fotito"',
    'property="og:locale" content="es_PE"',
    'property="og:image" content="https://mifotito.com/og.png"',
    'name="twitter:card" content="summary_large_image"',
    "#nl-badge-frame, #nl-hud-frame { display: none !important; }",
  ];
  if (page.path === "/") needles.push('"@type":["Organization","LocalBusiness"]');
  else if (html.includes("LocalBusiness")) throw new Error(`${file} no debería llevar el JSON-LD de la portada.`);
  for (const needle of needles) {
    if (!html.includes(needle)) throw new Error(`${file} no incluye ${needle}`);
  }
}
