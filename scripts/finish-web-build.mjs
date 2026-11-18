// Expo's web export only uses src/app/+html.tsx when `web.output` is "static" or
// "server". This project exports "single" (a pure SPA), so Expo writes its own
// default template and that file never runs. Everything the shop needs in <head>
// — Spanish lang, description, Open Graph for WhatsApp shares, the PWA manifest
// the Play Store app verifies against — is injected here instead.
//
// Runs as part of `npm run build:web`.

import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const DIST = process.env.EXPO_WEB_DIST || "dist";
const SITE = (process.env.EXPO_PUBLIC_SITE_URL || "https://mifotito.com").replace(/\/$/, "");

const TITLE = "Mi Fotito — marcos impresos en Perú";
const DESCRIPTION = "Mi Fotito imprime tu foto y te la lleva enmarcada a casa, en Lima y a provincias.";

const HEAD = `
    <meta name="description" content="${DESCRIPTION}" />
    <meta name="theme-color" content="#F6EFE6" />
    <link rel="canonical" href="${SITE}/" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="default" />
    <meta name="apple-mobile-web-app-title" content="Mi Fotito" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Mi Fotito" />
    <meta property="og:title" content="Mi Fotito" />
    <meta property="og:description" content="Una foto, un marco, y llega a la puerta." />
    <meta property="og:url" content="${SITE}/" />
    <meta property="og:image" content="${SITE}/icons/icon-512.png" />
    <meta property="og:image:width" content="512" />
    <meta property="og:image:height" content="512" />
    <meta property="og:locale" content="es_PE" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Mi Fotito" />
    <meta name="twitter:description" content="Una foto, un marco, y llega a la puerta." />
    <meta name="twitter:image" content="${SITE}/icons/icon-512.png" />
    <style>
      html, body, #root { background: #E7D3C3; }
      body { overflow-x: hidden; }
      /* Netlify injects a public HUD iframe on the free plan; it covers the tab bar. */
      #nl-badge-frame, #nl-hud-frame { display: none !important; }
    </style>`;

const file = join(DIST, "index.html");
let html = await readFile(file, "utf8");

if (html.includes('rel="manifest"')) {
  console.log("[finish-web-build] head already injected, nothing to do");
  process.exit(0);
}

const before = html;
html = html
  .replace('<html lang="en">', '<html lang="es">')
  .replace(
    '<meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />',
  )
  .replace("<title>Mi Fotito</title>", `<title>${TITLE}</title>${HEAD}`);

if (html === before) {
  // Expo changed its template. Fail loudly rather than deploy a page with no manifest.
  throw new Error("[finish-web-build] could not patch dist/index.html — the Expo template changed.");
}

await writeFile(file, html);
console.log("[finish-web-build] injected head into dist/index.html");
