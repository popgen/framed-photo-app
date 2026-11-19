import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { frames } from "../src/lib/catalog";
import { legalHtml } from "../src/lib/legal-html";
import { privacyDoc, termsDoc } from "../src/lib/legal";
import {
  DISALLOW,
  KEYWORD_TERMS,
  NOT_OFFERED,
  applySeoToHtml,
  canonicalUrl,
  organizationJsonLd,
  pageForPath,
  pages,
  robotsTxt,
  sitemapXml,
  spaShellPages,
} from "../src/lib/seo";

const APP = "src/app";

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith(".tsx") ? [path] : [];
  });
}

function routeFromFile(file: string): string | null {
  const base = file.slice(APP.length + 1).replace(/\.tsx$/, "");
  const parts = base.split("/");
  if (parts[parts.length - 1]?.startsWith("+") || parts[parts.length - 1]?.startsWith("_")) return null;
  if (parts[parts.length - 1] === "index") parts.pop();
  if (!parts.length) return "/";
  return `/${parts.join("/")}`;
}

function covered(route: string): boolean {
  if (pages.some((page) => page.path === route)) return true;
  return DISALLOW.some((rule) => {
    if (rule.endsWith("/")) return route.startsWith(rule);
    return route === rule || route.startsWith(`${rule}/`);
  });
}

describe("seo files", () => {
  it("allows every crawler and hides only private routes", () => {
    const robots = robotsTxt();
    expect(readFileSync("public/robots.txt", "utf8")).toBe(robots);
    expect(robots.startsWith("User-agent: *\nAllow: /\n")).toBe(true);
    for (const path of DISALLOW) expect(robots).toContain(`Disallow: ${path}`);
    expect(robots).toContain("Sitemap: https://mifotito.com/sitemap.xml");
    expect(robots).not.toContain("Disallow: /crear");
    expect(robots).not.toContain("Disallow: /privacidad");
  });

  it("lists every public page with an absolute url and lastmod", () => {
    const xml = sitemapXml();
    expect(readFileSync("public/sitemap.xml", "utf8")).toBe(xml);
    expect(xml).toContain('xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"');
    for (const page of pages) {
      expect(xml).toContain(`<loc>${canonicalUrl(page.path)}</loc>`);
      expect(xml).toContain("<lastmod>2026-11-19</lastmod>");
    }
    expect(xml).not.toContain("/admin");
    expect(xml).not.toContain("/carrito");
    expect(xml).not.toContain("/pedido/");
    expect(canonicalUrl("/crear")).toBe("https://mifotito.com/crear");
    expect(canonicalUrl("/")).toBe("https://mifotito.com/");
  });

  it("covers every screen in src/app", () => {
    const routes = walk(APP).map(routeFromFile).filter((route): route is string => Boolean(route));
    expect(routes.length).toBeGreaterThan(10);
    for (const route of routes) expect(covered(route), route).toBe(true);
  });

  it("keeps the Netlify files from being swallowed by the SPA fallback", () => {
    const toml = readFileSync("netlify.toml", "utf8");
    const script = readFileSync("scripts/publish-web.mjs", "utf8");
    expect(toml).toContain('Content-Type = "text/plain; charset=utf-8"');
    expect(toml).toContain('Content-Type = "application/xml; charset=utf-8"');
    expect(toml).not.toMatch(/from = "\/\*"[\s\S]{0,80}force = true/);
    expect(script).toContain('`${page.path.slice(1)}.html`');
    for (const page of spaShellPages()) {
      if (page.path === "/") continue;
      expect(toml).not.toContain(`to = "${page.path}/index.html"`);
    }
  });

  it("writes the head tags into the static html", () => {
    const home = pageForPath("/");
    const crear = pageForPath("/crear");
    if (!home || !crear) throw new Error("faltan páginas");
    const html = applySeoToHtml('<html lang="en"><head><title>Mi Fotito</title></head><body></body></html>', home);
    expect(html).toContain('<html lang="es"');
    expect(html.match(/<title\b/g)?.length).toBe(1);
    expect(html).toContain(`<title data-mifotito="title">${home.title}</title>`);
    expect(html).toContain('name="description"');
    expect(html).toContain('name="keywords"');
    expect(html).toContain('rel="canonical" href="https://mifotito.com/"');
    expect(html).toContain('property="og:image" content="https://mifotito.com/og.png"');
    expect(html).toContain('property="og:image:width" content="1200"');
    expect(html).toContain('property="og:image:height" content="630"');
    expect(html).toContain('name="twitter:card" content="summary_large_image"');
    expect(html).toContain('property="og:locale" content="es_PE"');
    expect(html).toContain("#nl-badge-frame, #nl-hud-frame { display: none !important; }");
    expect(html).toContain('"@type":["Organization","LocalBusiness"]');
    const crearHtml = applySeoToHtml('<html lang="en"><head><title>Mi Fotito</title></head><body></body></html>', crear);
    expect(crearHtml).toContain('rel="canonical" href="https://mifotito.com/crear"');
    expect(crearHtml).not.toContain("LocalBusiness");
    expect(crearHtml).not.toContain("https://mifotito.com/crear/");
  });

  it("publishes legal pages with the same head", () => {
    for (const doc of [privacyDoc, termsDoc]) {
      const page = pageForPath(doc.path);
      if (!page) throw new Error(doc.path);
      const html = legalHtml(doc);
      expect(html).toContain(`<title data-mifotito="title">${page.title}</title>`);
      expect(html).toContain(`rel="canonical" href="${page.canonical}"`);
      expect(html).toContain('lang="es"');
      expect(html).toContain('name="twitter:card" content="summary_large_image"');
    }
  });

  it("describes only products the shop sells", () => {
    expect(Math.min(...frames.map((frame) => frame.priceCents))).toBe(5900);
    const claims = pages.map((page) => `${page.title}\n${page.description}`).join("\n");
    for (const phrase of NOT_OFFERED) expect(claims.toLowerCase()).not.toContain(phrase.toLowerCase());
    expect(pageForPath("/retablo")?.description).toContain("hecho a mano");
    for (const page of pages) {
      if (page.path === "/retablo") continue;
      expect(page.description.toLowerCase()).not.toContain("hecho a mano");
    }
    const json = organizationJsonLd();
    expect(json).toContain("pedidos@mifotito.com");
    expect(json).toContain("Lima");
    expect(json).toContain("Perú");
    expect(json.toLowerCase()).not.toContain("telephone");
    expect(json.toLowerCase()).not.toContain("phone");
    expect(json.toLowerCase()).not.toContain("whatsapp");
    const visible = ["src/app/index.tsx", "src/app/muro.tsx", "src/app/regalo.tsx", "src/app/rastrear.tsx"]
      .map((file) => readFileSync(file, "utf8"))
      .join("\n");
    expect(visible).not.toContain("envío gratis");
    expect(visible).not.toContain("revelado");
    expect(visible).toContain("más cálido que un póster");
    expect(visible).toContain("álbum de fotos");
    expect(visible).toContain("no en un lienzo");
    expect(visible).toContain("collage impreso");
    for (const term of KEYWORD_TERMS) expect(KEYWORD_TERMS.join(", ")).toContain(term);
  });
});
