import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return /\.(tsx?|mjs|json|html|xml|sql|txt)$/.test(path) ? [path] : [];
  });
}

describe("no acrylic wording", () => {
  it("keeps 'acrílico' out of the site, data, emails and SEO", () => {
    const pattern = /acr[ií]lic|acrylic/i;
    const hits = [...files("src"), ...files("data"), ...files("public"), ...files("api"), "supabase/seed.sql"].filter((path) => pattern.test(readFileSync(path, "utf8")));
    expect(hits).toEqual([]);
  });
});
