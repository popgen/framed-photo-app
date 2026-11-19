export const SITE = "https://mifotito.com";
export const SITE_NAME = "Mi Fotito";
export const EMAIL = "pedidos@mifotito.com";
export const THEME_COLOR = "#F6EFE6";
export const LOCALE = "es_PE";
export const LASTMOD = "2026-11-19";
export const OG_IMAGE_PATH = "/og.png";
export const LOGO_PATH = "/logo.png";
export const OG_IMAGE_URL = `${SITE}${OG_IMAGE_PATH}`;
export const LOGO_URL = `${SITE}${LOGO_PATH}`;

export const SPA_CSS = `
          html, body, #root { height: 100%; background: #E7D3C3; }
          body { overflow-x: hidden; }
          /* Netlify injects the public HUD iframe on the free plan. It cannot be
             turned off in project settings, and its inline position covers the tab bar. */
          #nl-badge-frame, #nl-hud-frame { display: none !important; }
`;

export const BADGE_CSS = "#nl-badge-frame, #nl-hud-frame { display: none !important; }";

/** Phrases we do not sell. They stay in the keywords tag, or in copy that says we are not that. */
export const NOT_OFFERED = ["envío gratis", "revelado de fotos", "foto en lienzo", "póster de fotos", "álbumes de fotos"] as const;

export const KEYWORD_TERMS = [
  "Navidad",
  "regalos de Navidad",
  "regalos navideños",
  "regalos fáciles",
  "regalos baratos para Navidad",
  "regalos personalizados",
  "fotos",
  "marcos de fotos",
  "cuadros con fotos",
  "imprimir fotos",
  "fotos impresas",
  "impresión de fotos",
  "enmarcar fotos",
  "fotos enmarcadas",
  "tarjetas de Navidad personalizadas",
  "regalo para mamá",
  "regalo para papá",
  "regalo para abuelos",
  "regalos en Lima",
  "delivery Lima",
  "Perú",
  "San Valentín",
  "retablos",
  "fotos personalizadas",
  "álbumes de fotos",
  "decoración con fotos",
  "regalos originales",
  "regalos para mamá",
  "regalos para papá",
  "regalos para abuelos",
  "ideas de regalos",
  "tienda de fotos",
  "imprimir en línea",
  "imprimir fotos online",
  "foto en lienzo",
  "póster de fotos",
  "collage de fotos",
  "recuerdo",
  "recuerdo personalizado",
  "arte de pared",
  "decoración del hogar",
  "regalo sorpresa",
  "regalo económico",
  "envío gratis",
  "hecho a mano",
  "personalizado",
  "cuadros personalizados",
  "fotos en marco",
  "regalo de aniversario",
  "regalo de cumpleaños",
  "regalo para pareja",
  "foto con mensaje",
  "tarjeta con foto",
  "revelado de fotos",
  "Lima delivery",
] as const;

export const KEYWORDS = KEYWORD_TERMS.join(", ");

export type SeoEntry = {
  path: string;
  title: string;
  description: string;
};

export type SeoPage = SeoEntry & { canonical: string };

export const pages: SeoEntry[] = [
  {
    path: "/",
    title: "Mi Fotito — fotos enmarcadas y regalos de Navidad",
    description:
      "Regalos de Navidad en Lima: fotos enmarcadas desde S/ 59, con el envío incluido. Regalos navideños, cuadros con fotos y tarjetas personalizadas en el Perú.",
  },
  {
    path: "/crear",
    title: "Imprimir fotos y enmarcarlas — Mi Fotito",
    description:
      "Imprimir fotos online y enmarcarlas en un cuadro personalizado. Fotos en marco, con acrílico, para la mesa o la pared. Pedido en línea y delivery en Lima.",
  },
  {
    path: "/collage",
    title: "Collage de fotos en un marco — Mi Fotito",
    description:
      "Arma un collage de fotos con hasta 12 imágenes de tu dispositivo y recíbelo impreso en un marco. El precio es el del marco y el envío ya va incluido.",
  },
  {
    path: "/tarjeta",
    title: "Tarjetas de Navidad personalizadas — Mi Fotito",
    description:
      "Tarjetas de Navidad personalizadas: una tarjeta con foto y un mensaje, impresa con sobre incluido. Un regalo fácil para mamá, papá o los abuelos.",
  },
  {
    path: "/muro",
    title: "Cuadros con fotos para la pared — Mi Fotito",
    description:
      "Cuadros con fotos para colgar en la sala. Arma un muro y úsalo como decoración del hogar: arte de pared con tus fotos, en Lima.",
  },
  {
    path: "/regalo",
    title: "Regalo personalizado para un marco — Mi Fotito",
    description:
      "Una tarjeta de regalo para un marco. Llega por correo: un regalo sorpresa personalizado para quien tú elijas, en Lima y en el Perú.",
  },
  {
    path: "/retablo",
    title: "Retablos de madera hechos a mano — Mi Fotito",
    description:
      "Retablo de madera de tres hojas, hecho a mano al estilo de Ayacucho. Se pide por correo a pedidos@mifotito.com. No entra al carrito.",
  },
  {
    path: "/rastrear",
    title: "Rastrea tu pedido — Mi Fotito",
    description:
      "Sigue tu pedido de fotos enmarcadas con el celular. Lima delivery y envíos a provincias, de 2 a 3 días hábiles en Lima.",
  },
  {
    path: "/reclamo",
    title: "Reclamo de un marco dañado — Mi Fotito",
    description: "Si tu marco o tu tarjeta llegó dañada, cuéntanos y manda una foto. Si corresponde, reponemos el pedido.",
  },
  {
    path: "/privacidad",
    title: "Política de privacidad — Mi Fotito",
    description: "Política de privacidad de Mi Fotito, Lima, Perú. Imprimimos fotos enmarcadas. Consultas a pedidos@mifotito.com.",
  },
  {
    path: "/terminos",
    title: "Términos y condiciones — Mi Fotito",
    description: "Términos y condiciones de Mi Fotito, Lima, Perú. Los precios están en soles e incluyen el envío.",
  },
];

/** Token, account, cart and admin paths. Crawlers may fetch the rest. */
export const DISALLOW = ["/admin", "/api", "/pedido/", "/confirmacion/", "/w/", "/v/", "/cuenta", "/carrito", "/checkout", "/pago"];

const LEGAL_PATHS = new Set(["/privacidad", "/terminos"]);

export function canonicalUrl(path: string): string {
  const normal = normalizePath(path);
  if (normal === "/") return `${SITE}/`;
  return `${SITE}${normal}`;
}

export function normalizePath(path: string): string {
  const bare = path.split("?")[0]?.split("#")[0] ?? "/";
  if (bare === "" || bare === "/") return "/";
  const withSlash = bare.startsWith("/") ? bare : `/${bare}`;
  return withSlash.replace(/\/+$/, "");
}

export function pageForPath(path: string): SeoPage | null {
  const normal = normalizePath(path);
  const found = pages.find((page) => page.path === normal);
  if (!found) return null;
  return { ...found, canonical: canonicalUrl(found.path) };
}

export function spaShellPages(): SeoPage[] {
  return pages.flatMap((page) => {
    if (LEGAL_PATHS.has(page.path)) return [];
    const full = pageForPath(page.path);
    return full ? [full] : [];
  });
}

export function robotsTxt(): string {
  return ["User-agent: *", "Allow: /", ...DISALLOW.map((path) => `Disallow: ${path}`), "", `Sitemap: ${SITE}/sitemap.xml`, ""].join("\n");
}

export function sitemapXml(): string {
  const urls = pages
    .map((page) => `  <url><loc>${escapeHtml(canonicalUrl(page.path))}</loc><lastmod>${LASTMOD}</lastmod></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

export function organizationJsonLd(): string {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@type": ["Organization", "LocalBusiness"],
    name: SITE_NAME,
    url: canonicalUrl("/"),
    email: EMAIL,
    logo: LOGO_URL,
    image: OG_IMAGE_URL,
    areaServed: [
      { "@type": "City", name: "Lima" },
      { "@type": "Country", name: "Perú" },
    ],
  }).replace(/</g, "\\u003c");
}

export function headTags(page: SeoPage, options?: { jsonLd?: boolean; spa?: boolean }): string {
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const url = escapeHtml(page.canonical);
  const lines = [
    `<title data-mifotito="title">${title}</title>`,
    `<meta data-mifotito="description" name="description" content="${description}" />`,
    `<meta name="keywords" content="${escapeHtml(KEYWORDS)}" />`,
    `<meta name="theme-color" content="${THEME_COLOR}" />`,
    `<link data-mifotito="canonical" rel="canonical" href="${url}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="${LOCALE}" />`,
    `<meta data-mifotito="og:title" property="og:title" content="${title}" />`,
    `<meta data-mifotito="og:description" property="og:description" content="${description}" />`,
    `<meta data-mifotito="og:url" property="og:url" content="${url}" />`,
    `<meta property="og:image" content="${OG_IMAGE_URL}" />`,
    `<meta property="og:image:width" content="1200" />`,
    `<meta property="og:image:height" content="630" />`,
    `<meta property="og:image:alt" content="Mi Fotito: fotos enmarcadas en Lima, Perú" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta data-mifotito="twitter:title" name="twitter:title" content="${title}" />`,
    `<meta data-mifotito="twitter:description" name="twitter:description" content="${description}" />`,
    `<meta name="twitter:image" content="${OG_IMAGE_URL}" />`,
    // Makes the site installable, and gives the Play Store app (a Trusted Web
    // Activity over this same site) its name, icon and colours. See android-twa/.
    `<link rel="manifest" href="/manifest.webmanifest" />`,
    `<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />`,
    `<meta name="apple-mobile-web-app-capable" content="yes" />`,
    `<meta name="apple-mobile-web-app-status-bar-style" content="default" />`,
    `<meta name="apple-mobile-web-app-title" content="${SITE_NAME}" />`,
    `<meta name="mobile-web-app-capable" content="yes" />`,
  ];
  if (options?.jsonLd) lines.push(`<script type="application/ld+json">${organizationJsonLd()}</script>`);
  const css = options?.spa === false ? BADGE_CSS : SPA_CSS;
  lines.push(`<style>${css}</style>`);
  return `<!-- mifotito-seo:start -->\n${lines.join("\n")}\n<!-- mifotito-seo:end -->`;
}

export function applySeoToHtml(html: string, page: SeoPage): string {
  let next = html.replace(/<!-- mifotito-seo:start -->[\s\S]*?<!-- mifotito-seo:end -->/g, "");
  next = next.replace(/<html\b([^>]*)>/i, (_full, attrs: string) => {
    const cleaned = attrs.replace(/\slang="[^"]*"/i, "");
    return `<html lang="es"${cleaned}>`;
  });
  next = next.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, "");
  next = next.replace(/<meta\b[^>]*name=["']description["'][^>]*>/gi, "");
  next = next.replace(/<meta\b[^>]*name=["']keywords["'][^>]*>/gi, "");
  const block = headTags(page, { jsonLd: page.path === "/", spa: true });
  if (!next.includes("</head>")) throw new Error("El HTML exportado no tiene </head>.");
  next = next.replace("</head>", `${block}\n</head>`);
  return next;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
