import { ARC_BONUS, DISTANCE_POINT, NEAR_MISS_POINTS, PHOTO_POINTS, type ZoneId } from "./contest";

export function photoValue(zone: ZoneId): number {
  return PHOTO_POINTS[zone];
}

export function totalScore(parts: { distanceMeters: number; photoPoints: number; arcs: number; nearMisses: number }): number {
  return Math.floor(parts.distanceMeters) * DISTANCE_POINT + parts.photoPoints + parts.arcs * ARC_BONUS + parts.nearMisses * NEAR_MISS_POINTS;
}
