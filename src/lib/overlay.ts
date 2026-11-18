import presetsJson from "../../data/text-presets.json";

export type OverlayFontId = "pacifico" | "dancing" | "vibes" | "lobster" | "satisfy" | "amatic";

export type TextOverlay = {
  text: string;
  font: OverlayFontId;
  size: number;
  color: string;
  x: number;
  y: number;
  rotation: number;
};

export const OVERLAY_FONTS: { id: OverlayFontId; label: string; family: string; width: number }[] = [
  { id: "pacifico", label: "Pacifico", family: "Pacifico_400Regular", width: 0.58 },
  { id: "dancing", label: "Dancing", family: "DancingScript_600SemiBold", width: 0.52 },
  { id: "vibes", label: "Vibes", family: "GreatVibes_400Regular", width: 0.48 },
  { id: "lobster", label: "Lobster", family: "Lobster_400Regular", width: 0.62 },
  { id: "satisfy", label: "Satisfy", family: "Satisfy_400Regular", width: 0.55 },
  { id: "amatic", label: "Amatic", family: "AmaticSC_700Bold", width: 0.42 },
];

export const OVERLAY_COLORS = ["#FFFFFF", "#241714", "#D4A017", "#C5363C", "#1C4D3A", "#F6E7C1"] as const;

export const OVERLAY_SIZES = [
  { id: "s", label: "Chico", size: 0.08 },
  { id: "m", label: "Mediano", size: 0.12 },
  { id: "l", label: "Grande", size: 0.18 },
] as const;

export const textPresets = presetsJson as string[];

const SNAP = 0.07;

export function fontById(id: string) {
  return OVERLAY_FONTS.find((item) => item.id === id) ?? OVERLAY_FONTS[0];
}

export function emptyOverlay(partial?: Partial<TextOverlay>): TextOverlay {
  return {
    text: "",
    font: "pacifico",
    size: 0.12,
    color: "#FFFFFF",
    x: 0.5,
    y: 0.72,
    rotation: 0,
    ...partial,
  };
}

export function textSpan(overlay: Pick<TextOverlay, "text" | "font" | "size">): { w: number; h: number } {
  const factor = fontById(overlay.font).width;
  const w = Math.min(0.92, Math.max(overlay.size, overlay.text.length * overlay.size * factor));
  const h = overlay.size * 1.25;
  return { w, h };
}

export function placeOverlay(overlay: TextOverlay, snap = false, keepBreaks = false): TextOverlay {
  const text = keepBreaks ? keepLines(overlay.text) : overlay.text.replace(/\s+/g, " ").trim();
  const span = textSpan({ ...overlay, text: text || "A" });
  let x = overlay.x;
  let y = overlay.y;
  if (snap) {
    if (Math.abs(x - 0.5) <= SNAP) x = 0.5;
    if (Math.abs(y - 0.5) <= SNAP) y = 0.5;
  }
  const halfW = span.w / 2;
  const halfH = span.h / 2;
  x = clamp(x, halfW, 1 - halfW);
  y = clamp(y, halfH, 1 - halfH);
  const rotation = ((Math.round(overlay.rotation / 8) * 8) % 360 + 360) % 360;
  return {
    text,
    font: fontById(overlay.font).id,
    size: clamp(overlay.size, 0.06, 0.22),
    color: overlay.color,
    x,
    y,
    rotation: rotation > 180 ? rotation - 360 : rotation,
  };
}

export function serializeOverlay(overlay: TextOverlay | null | undefined): TextOverlay | null {
  if (!overlay?.text.trim()) return null;
  return placeOverlay(overlay);
}

export function parseOverlay(raw: unknown): TextOverlay | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Partial<TextOverlay>;
  if (typeof value.text !== "string" || !value.text.trim()) return null;
  return placeOverlay({
    text: value.text,
    font: (value.font ?? "pacifico") as OverlayFontId,
    size: Number(value.size ?? 0.12),
    color: typeof value.color === "string" ? value.color : "#FFFFFF",
    x: Number(value.x ?? 0.5),
    y: Number(value.y ?? 0.72),
    rotation: Number(value.rotation ?? 0),
  });
}

function keepLines(value: string): string {
  return value
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[^\S\n]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return (min + max) / 2;
  return Math.min(max, Math.max(min, value));
}
