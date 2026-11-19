import { cpSync, readFileSync, writeFileSync } from "node:fs";

// Expo's single-page export does not copy public/ and does not use src/app/+html.tsx.
// The legal pages have to be real files so Netlify can return them without JavaScript.
cpSync("public", "dist", { recursive: true });

const indexPath = "dist/index.html";
let html = readFileSync(indexPath, "utf8");
html = html.replace("<html lang=\"en\">", "<html lang=\"es\">");
if (html.includes("<title>Mi Fotito</title>")) {
  html = html.replace("<title>Mi Fotito</title>", "<title>Mi Fotito — marcos impresos en Perú</title>");
}
const noscript =
  '<noscript><div style="max-width:640px;margin:0 auto;padding:24px;font-family:Georgia,serif;color:#241714"><p style="font-size:32px">Mi Fotito</p><p>Marcos impresos en Lima, Perú.</p><p><a href="/privacidad">Política de privacidad</a> · <a href="/terminos">Términos y condiciones</a></p></div></noscript>';
if (html.includes("You need to enable JavaScript")) {
  html = html.replace(/<noscript>[\s\S]*?<\/noscript>/, noscript);
} else if (!html.includes('href="/privacidad"')) {
  html = html.replace("</body>", `${noscript}</body>`);
}
writeFileSync(indexPath, html);
