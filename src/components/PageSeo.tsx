import Head from "expo-router/head";
import { useEffect } from "react";
import { Platform } from "react-native";
import { organizationJsonLd, pageForPath, type SeoPage } from "../lib/seo";

function syncStaticTags(page: SeoPage) {
  if (typeof document === "undefined") return;
  const set = (key: string, attr: "text" | "content" | "href", value: string) => {
    const el = document.head.querySelector(`[data-mifotito="${key}"]`);
    if (!el) return;
    if (attr === "text") el.textContent = value;
    else el.setAttribute(attr, value);
  };
  set("title", "text", page.title);
  set("description", "content", page.description);
  set("canonical", "href", page.canonical);
  set("og:title", "content", page.title);
  set("og:description", "content", page.description);
  set("og:url", "content", page.canonical);
  set("twitter:title", "content", page.title);
  set("twitter:description", "content", page.description);
  document.title = page.title;
}

export function PageSeo({ path }: { path: string }) {
  const page = pageForPath(path);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const found = pageForPath(path);
    if (!found) return;
    syncStaticTags(found);
  }, [path]);
  if (!page) return null;
  return (
    <Head>
      <title>{page.title}</title>
      <meta name="description" content={page.description} />
      <link rel="canonical" href={page.canonical} />
      <meta property="og:url" content={page.canonical} />
      <meta property="og:title" content={page.title} />
      <meta property="og:description" content={page.description} />
      <meta name="twitter:title" content={page.title} />
      <meta name="twitter:description" content={page.description} />
      {page.path === "/" ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: organizationJsonLd() }} /> : null}
    </Head>
  );
}
