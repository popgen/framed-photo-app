import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

// NOTE: Expo only uses this file when `web.output` is "static" or "server".
// app.json sets "single", so the production export ignores it and Expo writes its
// own default template. The real <head> for the deployed site is injected by
// scripts/finish-web-build.mjs. Keep the two in sync, or move to "static" output
// and delete the script.

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>Mi Fotito — marcos impresos en Perú</title>
        <meta name="description" content="Mi Fotito imprime tu foto y te la lleva enmarcada a casa, en Lima y a provincias." />
        <meta property="og:title" content="Mi Fotito" />
        <meta property="og:description" content="Una foto, un marco, y llega a la puerta." />
        <meta name="theme-color" content="#F6EFE6" />
        <ScrollViewStyleReset />
        <style>{`
          html, body, #root { height: 100%; background: #E7D3C3; }
          body { overflow-x: hidden; }
          /* Netlify injects the public HUD iframe on the free plan. It cannot be
             turned off in project settings, and its inline position covers the tab bar. */
          #nl-badge-frame, #nl-hud-frame { display: none !important; }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
