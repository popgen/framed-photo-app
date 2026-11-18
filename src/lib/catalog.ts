import framesJson from "../../data/frames.json";

export type Material = "black" | "white" | "wood" | "gold";
export type Tier = "basic" | "wall" | "premium";
export type Aspect = "3:4" | "1:1";

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
};

export const frames = framesJson as FrameDef[];

export function frameById(id: string): FrameDef {
  const frame = frames.find((item) => item.id === id);
  if (!frame) throw new Error(`Marco desconocido: ${id}`);
  return frame;
}

export function openingOf(frame: FrameDef): { x: number; y: number; w: number; h: number } {
  return {
    x: (frame.outerWcm - frame.printWcm) / 2 / frame.outerWcm,
    y: (frame.outerHcm - frame.printHcm) / 2 / frame.outerHcm,
    w: frame.printWcm / frame.outerWcm,
    h: frame.printHcm / frame.outerHcm,
  };
}

export function aspectParts(frame: FrameDef, orientation: "portrait" | "landscape"): [number, number] {
  if (frame.aspect === "1:1") return [1, 1];
  return orientation === "landscape" ? [4, 3] : [3, 4];
}
