import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

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
          /* Netlify injects a fixed "Powered by Netlify" iframe (#nl-badge-frame) at bottom: 0.
             The inline style wins unless overridden. Keep the badge, but sit it above the tab bar. */
          #nl-badge-frame, #nl-hud-frame {
            bottom: calc(76px + env(safe-area-inset-bottom, 0px)) !important;
            transform: scale(0.78);
            transform-origin: bottom right;
          }
        `}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
