import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";
import { KEYWORDS, OG_IMAGE_URL, SITE_NAME, SPA_CSS, THEME_COLOR, pageForPath, type SeoPage } from "../lib/seo";

function homePage(): SeoPage {
  const page = pageForPath("/");
  if (!page) throw new Error("Falta la página de inicio en el SEO.");
  return page;
}

const home = homePage();

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>{home.title}</title>
        <meta name="description" content={home.description} />
        <meta name="keywords" content={KEYWORDS} />
        <meta name="theme-color" content={THEME_COLOR} />
        <link rel="canonical" href={home.canonical} />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content={SITE_NAME} />
        <meta property="og:locale" content="es_PE" />
        <meta property="og:title" content={home.title} />
        <meta property="og:description" content={home.description} />
        <meta property="og:url" content={home.canonical} />
        <meta property="og:image" content={OG_IMAGE_URL} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={home.title} />
        <meta name="twitter:description" content={home.description} />
        <meta name="twitter:image" content={OG_IMAGE_URL} />
        <ScrollViewStyleReset />
        <style>{SPA_CSS}</style>
      </head>
      <body>
        {children}
        <noscript>
          <div style={{ maxWidth: 640, margin: "0 auto", padding: 24, fontFamily: "Georgia, serif", color: "#241714" }}>
            <p style={{ fontSize: 32, marginBottom: 8 }}>Mi Fotito</p>
            <p>Marcos impresos en Lima, Perú.</p>
            <p>
              <a href="/privacidad">Política de privacidad</a>
              {" · "}
              <a href="/terminos">Términos y condiciones</a>
            </p>
          </div>
        </noscript>
      </body>
    </html>
  );
}
