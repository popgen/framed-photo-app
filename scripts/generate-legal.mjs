// Writes the two standalone legal pages that Netlify serves directly:
//   public/privacidad/index.html
//   public/terminos/index.html
//
//   npm run generate:legal
//
// They are committed files rather than build output because Google's OAuth review
// has to reach them, and tests/legal.test.ts asserts each one still matches
// legalHtml(). Run this after changing src/lib/legal.ts, src/lib/legal-html.ts,
// or anything in src/lib/seo.ts that feeds headTags() — otherwise that test fails
// and the reason is not obvious.
//
// Loaded through Vite rather than node --experimental-strip-types because these
// modules import each other without file extensions, which bare Node cannot
// resolve. Vite is already a dependency (vitest), so this adds no tooling.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createServer } from "vite";

const server = await createServer({
  server: { middlewareMode: true },
  appType: "custom",
  logLevel: "error",
});

try {
  const { legalHtml } = await server.ssrLoadModule("/src/lib/legal-html.ts");
  const { privacyDoc, termsDoc } = await server.ssrLoadModule("/src/lib/legal.ts");

  for (const [file, doc] of [
    ["public/privacidad/index.html", privacyDoc],
    ["public/terminos/index.html", termsDoc],
  ]) {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, legalHtml(doc));
    console.log("wrote", file);
  }
} finally {
  await server.close();
}
