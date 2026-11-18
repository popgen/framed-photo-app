import framesJson from "../../data/frames.json";

export type Material = "black" | "white" | "wood" | "gold";
export type Tier = "basic" | "wall" | "premium";
export type Aspect = "3:4" | "1:1";
export type FrameStyle = "traditional" | "peruvian";

export type BorderCm = { top: number; right: number; bottom: number; left: number };

export type FrameDef = {
  id: string;
  name: string;
  sizeLabel: string;
  tier: Tier;
  tierLabel: string;
  priceCents: number;
  printWcm: number;
  printHcm: number;
  outerWcm: number;
  outerHcm: number;
  mouldingCm: number;
  aspect: Aspect;
  material: Material;
  mat: boolean;
  stand: boolean;
  hanging: boolean;
  consumes: { sku: string; qty: number }[];
  blurb: string;
  sort: number;
  category?: "navidad";
  style?: FrameStyle;
  border?: BorderCm;
};

export const frames = framesJson as FrameDef[];

export function frameById(id: string): FrameDef {
  const frame = frames.find((item) => item.id === id);
  if (!frame) throw new Error(`Marco desconocido: ${id}`);
  return frame;
}

export function borderOf(frame: FrameDef): BorderCm {
  if (frame.border) return frame.border;
  return {
    top: (frame.outerHcm - frame.printHcm) / 2,
    right: (frame.outerWcm - frame.printWcm) / 2,
    bottom: (frame.outerHcm - frame.printHcm) / 2,
    left: (frame.outerWcm - frame.printWcm) / 2,
  };
}

export function openingOf(frame: FrameDef): { x: number; y: number; w: number; h: number } {
  const border = borderOf(frame);
  return {
    x: border.left / frame.outerWcm,
    y: border.top / frame.outerHcm,
    w: frame.printWcm / frame.outerWcm,
    h: frame.printHcm / frame.outerHcm,
  };
}

export function pointInPhoto(frame: FrameDef, x: number, y: number): boolean {
  const open = openingOf(frame);
  return x >= open.x && x <= open.x + open.w && y >= open.y && y <= open.y + open.h;
}

export function aspectParts(frame: FrameDef, orientation: "portrait" | "landscape"): [number, number] {
  if (frame.aspect === "1:1") return [1, 1];
  return orientation === "landscape" ? [4, 3] : [3, 4];
}
