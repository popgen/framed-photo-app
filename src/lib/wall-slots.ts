export type WallSlotPhoto = { id: string; width: number; height: number };

export function replaceWallSlot<T>(slots: (T | null | undefined)[], index: number, photo: T | null): (T | null)[] {
  const next: (T | null)[] = slots.map((item) => item ?? null);
  while (next.length <= index) next.push(null);
  next[index] = photo;
  return next;
}

export function fillEmptyWallSlots<T>(slots: (T | null | undefined)[], count: number, incoming: T[]): (T | null)[] {
  const next: (T | null)[] = Array.from({ length: count }, (_, index) => slots[index] ?? null);
  let cursor = 0;
  for (let index = 0; index < count && cursor < incoming.length; index += 1) {
    if (next[index]) continue;
    next[index] = incoming[cursor];
    cursor += 1;
  }
  return next;
}

export function wallPhotosReady(slots: (unknown | null | undefined)[], count: number): boolean {
  if (count <= 0) return false;
  for (let index = 0; index < count; index += 1) {
    if (!slots[index]) return false;
  }
  return true;
}
