import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Machu Picchu sample scene", () => {
  it("animates only the preview and keeps a still image for reduced motion", () => {
    const scene = readFileSync("src/components/SampleScene.tsx", "utf8");
    const frame = readFileSync("src/components/FrameView.tsx", "utf8");
    const cart = readFileSync("src/app/carrito.tsx", "utf8");
    const home = readFileSync("src/app/index.tsx", "utf8");
    expect(scene).toContain("machu-picchu-bg.jpg");
    expect(scene).toContain("sample-memory.png");
    expect(scene).toContain("mifotito-zoom");
    expect(scene).toContain("26s");
    expect(scene).toContain("scale(1.06)");
    expect(scene).toContain("IntersectionObserver");
    expect(frame).toContain('photoId === "asset:sample"');
    expect(frame).toContain("animateSample");
    expect(home).toContain("animateSample");
    expect(cart).not.toContain("animateSample");
    expect(readFileSync("src/lib/print-export.web.ts", "utf8")).not.toContain("SampleScene");
  });
});