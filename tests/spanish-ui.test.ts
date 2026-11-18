import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FORBIDDEN = /\b(sandbox|checkout|gift card|choose file|no file chosen|loading|please|submit|welcome|hello|click here|sign in|password|upload|download|required|invalid|try again|not found|print shop|admin_users)\b/i;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return files(path);
    return path.endsWith(".tsx") || path.endsWith(".ts") ? [path] : [];
  });
}

function stringsIn(source: string): string[] {
  const found: string[] = [];
  const pattern = /(["'`])(?:\\.|(?!\1).)*\1/g;
  for (const match of source.matchAll(pattern)) {
    const raw = match[0].slice(1, -1);
    if (raw.startsWith("/") || raw.startsWith(".") || raw.startsWith("http") || raw.includes("${")) continue;
    if (FORBIDDEN.test(raw)) found.push(raw);
  }
  return found;
}

describe("Spanish UI", () => {
  it("keeps customer and admin screens free of common English phrases", () => {
    const hits = [...files("src/app"), ...files("src/components")].flatMap((path) =>
      stringsIn(readFileSync(path, "utf8")).map((text) => `${path}: ${text}`),
    );
    expect(hits).toEqual([]);
  });
});
