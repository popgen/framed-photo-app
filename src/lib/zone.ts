import type { Zone } from "./cutoff";
import places from "../../data/peru-places.json";

export type PlaceTree = Record<string, Record<string, string[]>>;

export const placesTree = places as PlaceTree;

export const DEPARTMENTS = Object.keys(placesTree);

const ALIASES: Record<string, string> = {
  surco: "santiago de surco",
  magdalena: "magdalena del mar",
  "cercado de lima": "lima",
  "san juan lurigancho": "san juan de lurigancho",
};

const LIMA_METRO = new Set((placesTree.Lima?.Lima ?? []).map(fold));

export function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .trim();
}

export function provincesFor(department: string): string[] {
  return Object.keys(placesTree[department] ?? {});
}

export function districtsFor(department: string, province: string): string[] {
  return placesTree[department]?.[province] ?? [];
}

export function shippingZone(department: string, province: string, district = ""): Zone {
  const dep = fold(department);
  const prov = fold(province);
  const dist = ALIASES[fold(district)] ?? fold(district);
  if (dep === "callao") return "lima";
  if (dep === "lima" && (prov === "lima" || LIMA_METRO.has(dist))) return "lima";
  return "provinces";
}
