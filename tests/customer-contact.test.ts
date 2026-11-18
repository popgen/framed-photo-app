import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { supportNumber } from "../src/lib/env";

const FORBIDDEN = /whatsapp|wa\.me|51999999999/i;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (path.startsWith(join("src", "app", "admin"))) return [];
    if (statSync(path).isDirectory()) return files(path);
    return path.endsWith(".tsx") || path.endsWith(".ts") ? [path] : [];
  });
}

function stringsIn(source: string): string[] {
  const found: string[] = [];
  const pattern = /(["'`])(?:\\.|(?!\1).)*\1/g;
  for (const match of source.matchAll(pattern)) {
    const raw = match[0].slice(1, -1);
    if (raw === "whatsapp" || raw === "web") continue;
    if (FORBIDDEN.test(raw)) found.push(raw);
  }
  return found;
}

describe("customer contact", () => {
  it("does not invent a WhatsApp number", () => {
    const previous = process.env.EXPO_PUBLIC_WHATSAPP_SUPPORT_NUMBER;
    delete process.env.EXPO_PUBLIC_WHATSAPP_SUPPORT_NUMBER;
    expect(supportNumber()).toBe("");
    if (previous === undefined) delete process.env.EXPO_PUBLIC_WHATSAPP_SUPPORT_NUMBER;
    else process.env.EXPO_PUBLIC_WHATSAPP_SUPPORT_NUMBER = previous;
  });

  it("keeps WhatsApp out of customer-facing copy", () => {
    const code = [...files("src/app"), ...files("src/components"), "src/lib/legal.ts"];
    const hits = code.flatMap((path) => stringsIn(readFileSync(path, "utf8")).map((text) => `${path}: ${text}`));
    const pages = ["data/campaign.json", "data/campaign-san-valentin.json", "data/reviews.json", "public/privacidad/index.html", "public/terminos/index.html"];
    for (const path of pages) {
      if (FORBIDDEN.test(readFileSync(path, "utf8"))) hits.push(path);
    }
    expect(hits).toEqual([]);
  });
});
