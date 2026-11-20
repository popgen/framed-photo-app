import { zoneAt, type ZoneId } from "./contest";

export type Paint = { from: ZoneId; to: ZoneId; t: number };

/** Blend the last 80 m of a zone into the next one. */
export function zonePaint(meters: number): Paint {
  const edges = [500, 1200, 2500];
  const zone = zoneAt(meters);
  const nextEdge = edges.find((edge) => meters < edge);
  if (!nextEdge) return { from: 4, to: 4, t: 0 };
  const start = nextEdge - 80;
  if (meters <= start) return { from: zone, to: zone, t: 0 };
  return { from: zone, to: zoneAt(nextEdge) , t: Math.min(1, (meters - start) / 80) };
}

export function suitDarkness(meters: number): number {
  const paint = zonePaint(meters);
  const dark = [0, 0.18, 0.38, 0.62];
  return dark[paint.from - 1] + (dark[paint.to - 1] - dark[paint.from - 1]) * paint.t;
}
