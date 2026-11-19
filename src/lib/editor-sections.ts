export const EDITOR_SECTIONS = ["frame", "photo", "text", "voice"] as const;

export type EditorSection = (typeof EDITOR_SECTIONS)[number];

export const INITIAL_EDITOR_SECTION: EditorSection = "frame";

export function editorHeaderId(section: EditorSection): string {
  return `editor-section-${section}`;
}

/** Opening a section closes every other one. Tapping the open header closes it. */
export function toggleEditorSection(current: EditorSection | null, target: EditorSection): EditorSection | null {
  return current === target ? null : target;
}

export type VerticalBox = { top: number; bottom: number };

/** Pixels to move the scrollport so the header sits fully inside it. Zero when it already does. */
export function scrollDeltaForHeader(header: VerticalBox, viewport: VerticalBox): number {
  const slack = 1;
  if (header.top < viewport.top - slack) return header.top - viewport.top;
  if (header.bottom > viewport.bottom + slack) return header.bottom - viewport.bottom;
  return 0;
}

function scrollableAncestor(node: HTMLElement): HTMLElement | null {
  let parent = node.parentElement;
  while (parent) {
    const style = getComputedStyle(parent);
    const overflow = `${style.overflowY} ${style.overflow}`;
    const scrolls = /(auto|scroll|overlay)/.test(overflow) && parent.scrollHeight > parent.clientHeight + 1;
    if (scrolls) return parent;
    parent = parent.parentElement;
  }
  return null;
}

/** Scrolls the section header into view only when it is outside the editor scrollport. */
export function revealEditorHeader(section: EditorSection, reducedMotion = false): boolean {
  if (typeof document === "undefined") return false;
  const header = document.getElementById(editorHeaderId(section));
  if (!header) return false;
  const scroller = scrollableAncestor(header);
  const viewport = scroller ? scroller.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
  const delta = scrollDeltaForHeader(header.getBoundingClientRect(), viewport);
  if (delta === 0) return false;
  const behavior = reducedMotion ? "auto" : "smooth";
  if (scroller) {
    const top = scroller.scrollTop + delta;
    try {
      scroller.scrollTo({ top, behavior });
    } catch {
      scroller.scrollTop = top;
    }
  } else {
    header.scrollIntoView({ block: "nearest", inline: "nearest", behavior });
  }
  return true;
}
