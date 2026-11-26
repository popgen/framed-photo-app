/** Viewport-relative box for a field or the window. */
export type PlaceBox = {
  top: number;
  bottom: number;
  left: number;
  width: number;
};

export type PlaceViewport = {
  width: number;
  height: number;
};

export type PlacePickerLayout = {
  top: number;
  left: number;
  width: number;
  height: number;
  placement: "below" | "above";
};

const DEFAULT_MAX_HEIGHT = 280;
const DEFAULT_GAP = 4;
const DEFAULT_MARGIN = 8;
const DEFAULT_MIN_HEIGHT = 120;

/**
 * Position a list next to its field: directly below when there is room,
 * otherwise above. Coordinates are viewport-relative (for position: fixed).
 */
export function placePickerLayout(
  field: PlaceBox,
  viewport: PlaceViewport,
  options: { maxHeight?: number; gap?: number; margin?: number; minHeight?: number } = {},
): PlacePickerLayout {
  const maxHeight = options.maxHeight ?? DEFAULT_MAX_HEIGHT;
  const gap = options.gap ?? DEFAULT_GAP;
  const margin = options.margin ?? DEFAULT_MARGIN;
  const minHeight = options.minHeight ?? DEFAULT_MIN_HEIGHT;

  const width = Math.max(0, Math.min(field.width, viewport.width - margin * 2));
  let left = field.left;
  if (left + width > viewport.width - margin) left = viewport.width - margin - width;
  if (left < margin) left = margin;

  const spaceBelow = viewport.height - field.bottom - gap - margin;
  const spaceAbove = field.top - gap - margin;
  const openBelow = spaceBelow >= minHeight || spaceBelow >= spaceAbove;

  if (openBelow) {
    const height = clamp(Math.min(maxHeight, Math.max(0, spaceBelow)), 0, maxHeight);
    return { top: field.bottom + gap, left, width, height, placement: "below" };
  }

  const height = clamp(Math.min(maxHeight, Math.max(0, spaceAbove)), 0, maxHeight);
  return { top: field.top - gap - height, left, width, height, placement: "above" };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Case- and accent-insensitive filter, matching the Peru place list. */
export function filterPlaces(items: string[], query: string): string[] {
  const needle = foldPlace(query);
  if (!needle) return items;
  return items.filter((item) => foldPlace(item).includes(needle));
}

export function foldPlace(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}
