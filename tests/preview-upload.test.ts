import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("creator sample upload prompt", () => {
  it("invites a tap that reuses the device picker", () => {
    const crear = readFileSync("src/app/crear.tsx", "utf8");
    const sources = readFileSync("src/components/PhotoSources.tsx", "utf8");
    expect(crear).toContain("Sube tu foto");
    expect(crear).toContain('accessibilityRole="button"');
    expect(crear).toContain('accessibilityLabel="Sube tu foto desde tu dispositivo"');
    expect(crear).toContain('cursor: "pointer"');
    expect(crear).toContain("pickFromDevice");
    expect(crear).toContain("isExamplePhoto(photo.id)");
    expect(crear).not.toContain("Foto de ejemplo");
    expect(crear).not.toContain("Toca aquí");
    expect(sources).toContain("pickFromDevice()");
    expect(sources).toContain('chooseRef.current("gallery")');
    expect(sources).toContain('onPress={() => void choose("gallery")}');
    expect(sources).toContain("Desde mi dispositivo / galería");
    expect(sources).toContain("Tomar foto");
    expect(sources).toContain("Desde tu iPhone / iCloud");
    const photos = readFileSync("src/lib/photos.ts", "utf8");
    expect(photos).toContain("document.body.appendChild(input)");
  });
});
