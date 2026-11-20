/** Close of the Santa a la Carrera contest. One constant, Lima time. */
export const CONTEST_CLOSE_ISO = "2026-12-15T23:59:59-05:00";

export const CONTEST_CLOSE_LABEL = "15 de diciembre de 2026 23:59 hora de Lima";

/** Existing three-frame set on the wall page. */
export const PRIZE_NAME = "Trío parejo";

export const PRIZE_DETAIL = "tres marcos 15×20 iguales, en fila";

export const CONTEST_CLOSE_MS = Date.parse(CONTEST_CLOSE_ISO);

export function contestOpen(now: Date): boolean {
  return now.getTime() <= CONTEST_CLOSE_MS;
}

export const ZONES = [
  { id: 1 as const, name: "Pueblo Nevado", from: 0, until: 500 },
  { id: 2 as const, name: "Bosque al Atardecer", from: 500, until: 1200 },
  { id: 3 as const, name: "Noche Torcida", from: 1200, until: 2500 },
  { id: 4 as const, name: "Pesadilla", from: 2500, until: Number.POSITIVE_INFINITY },
];

export type ZoneId = (typeof ZONES)[number]["id"];

export function zoneAt(meters: number): ZoneId {
  if (meters < 500) return 1;
  if (meters < 1200) return 2;
  if (meters < 2500) return 3;
  return 4;
}

export function zoneName(id: ZoneId): string {
  return ZONES[id - 1]?.name ?? ZONES[0].name;
}

export const PHOTO_POINTS: Record<ZoneId, number> = { 1: 25, 2: 50, 3: 75, 4: 100 };

export const ARC_BONUS = 100;
export const NEAR_MISS_POINTS = 10;
export const DISTANCE_POINT = 1;
