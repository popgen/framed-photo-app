import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <meta name="theme-color" content="#F6EFE6" />
        <ScrollViewStyleReset />
        <style>{`html, body, #root { height: 100%; background: #E7D3C3; } body { overflow-x: hidden; }`}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
