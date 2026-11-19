import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { frames } from "../src/lib/catalog";
import {
  INITIAL_EDITOR_SECTION,
  editorHeaderId,
  scrollDeltaForHeader,
  toggleEditorSection,
  type EditorSection,
} from "../src/lib/editor-sections";

const sections: EditorSection[] = ["frame", "photo", "text", "voice"];

describe("editor accordion", () => {
  it("opens the frame picker first and leaves the other sections collapsed", () => {
    expect(INITIAL_EDITOR_SECTION).toBe("frame");
  });

  it("keeps a single section open and closes it when its header is tapped again", () => {
    let open: EditorSection | null = INITIAL_EDITOR_SECTION;
    expect(open).toBe("frame");
    open = toggleEditorSection(open, "photo");
    expect(open).toBe("photo");
    open = toggleEditorSection(open, "text");
    expect(open).toBe("text");
    open = toggleEditorSection(open, "voice");
    expect(open).toBe("voice");
    open = toggleEditorSection(open, "frame");
    expect(open).toBe("frame");
    open = toggleEditorSection(open, "frame");
    expect(open).toBeNull();
    for (const section of sections) {
      expect(toggleEditorSection(section, section)).toBeNull();
      expect(toggleEditorSection(null, section)).toBe(section);
    }
  });

  it("scrolls a header into view only when it sits outside the visible editor", () => {
    const viewport = { top: 80, bottom: 700 };
    expect(scrollDeltaForHeader({ top: 120, bottom: 164 }, viewport)).toBe(0);
    expect(scrollDeltaForHeader({ top: 40, bottom: 84 }, viewport)).toBe(40 - 80);
    expect(scrollDeltaForHeader({ top: 680, bottom: 724 }, viewport)).toBe(724 - 700);
  });

  it("gives each section header a stable id", () => {
    expect(sections.map(editorHeaderId)).toEqual([
      "editor-section-frame",
      "editor-section-photo",
      "editor-section-text",
      "editor-section-voice",
    ]);
  });
});

describe("editor screen wiring", () => {
  const crear = readFileSync("src/app/crear.tsx", "utf8");

  it("uses the shared collapsible accordion for frame, crop, text and voice", () => {
    expect(crear).toContain('title="Elige tu marco"');
    expect(crear).toContain('title="Encuadra la foto"');
    expect(crear).toContain("toggleEditorSection");
    expect(crear).toContain("INITIAL_EDITOR_SECTION");
    expect(crear).toContain("revealEditorHeader");
    for (const section of sections) {
      expect(crear).toContain(`editorHeaderId("${section}")`);
    }
    expect(crear).not.toContain("Encadra");
  });

  it("shows frame names in the picker and keeps descriptions in the catalog", () => {
    expect(crear).not.toContain("frame.blurb");
    expect(crear).not.toContain("item.blurb");
    expect(crear).toContain("{item.name}");
    expect(crear).not.toContain("item.name.split");
    const nieve = frames.find((frame) => frame.id === "nieve-celeste");
    expect(nieve?.name).toBe("Nieve Celeste");
    expect(nieve?.blurb.toLowerCase()).toContain("muñeco");
    expect(nieve?.blurb.toLowerCase()).toContain("arbolito");
  });

  it("spells the crop heading correctly on the card editor too", () => {
    const tarjeta = readFileSync("src/app/tarjeta.tsx", "utf8");
    expect(tarjeta).toContain("Encuadra la foto");
    expect(tarjeta).not.toContain("Encadra");
  });
});
