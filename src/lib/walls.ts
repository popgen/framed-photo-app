import { isOfferedFrame } from "./catalog";

export type WallLayout = {
  id: "trio" | "grid" | "mixed";
  name: string;
  description: string;
  finishes: { id: string; label: string; frames: string[] }[];
};

export const walls: WallLayout[] = [
  {
    id: "trio",
    name: "Trío parejo",
    description: "Tres marcos 15×20 iguales, en fila.",
    finishes: [
      { id: "wood", label: "Madera", frames: ["wood-15", "wood-15", "wood-15"] },
      { id: "black", label: "Negro", frames: ["thin-black-15", "thin-black-15", "thin-black-15"] },
      { id: "white", label: "Blanco", frames: ["thin-white-15", "thin-white-15", "thin-white-15"] },
      { id: "gold", label: "Dorado", frames: ["thin-gold-15", "thin-gold-15", "thin-gold-15"] },
    ],
  },
  {
    id: "grid",
    name: "Cuadrícula",
    description: "Cuatro cuadrados 20×20 para una pared llena.",
    finishes: [{ id: "black", label: "Negro", frames: ["square-black-20", "square-black-20", "square-black-20", "square-black-20"] }],
  },
  {
    id: "mixed",
    name: "Mixto",
    description: "Un 30×40 al centro y dos 15×20 a los lados.",
    finishes: [
      { id: "black", label: "Negro", frames: ["thin-black-15", "black-30", "thin-black-15"] },
      { id: "white", label: "Blanco", frames: ["thin-white-15", "white-30", "thin-white-15"] },
      { id: "wood", label: "Madera", frames: ["wood-15", "wood-30", "wood-15"] },
    ],
  },
];

/** Wall sets whose frames are all still on sale. Layouts left without a finish are hidden. */
export const offeredWalls: WallLayout[] = walls
  .map((layout) => ({ ...layout, finishes: layout.finishes.filter((finish) => finish.frames.every(isOfferedFrame)) }))
  .filter((layout) => layout.finishes.length > 0);
