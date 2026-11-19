/** Photos stay until 30 days after delivery or cancellation. This module only decides; it does not call Supabase. */

export const RETENTION_DAYS = 30;
export const PHOTO_BUCKET = "photos";

const DAY_MS = 24 * 60 * 60 * 1000;
const AUDIO = /\.(mp3|m4a|aac|ogg|wav|webm|mpeg)$/i;

export type OrderRow = { id: string; status: string; updated_at: string };
export type ItemRow = {
  id: string;
  order_id: string;
  photo_path?: string | null;
  original_path?: string | null;
  print_path?: string | null;
  card?: unknown;
  voice?: unknown;
};
export type ClaimRow = { id: string; order_id: string; photo_path?: string | null };
export type NoteRow = {
  token: string;
  storage_path?: string | null;
  selfie_path?: string | null;
  created_at?: string | null;
};
export type ObjectRow = { path: string; createdAt?: string | null };

export type ItemPatch = {
  id: string;
  card?: unknown;
  voice?: unknown;
};

export type PurgePlan = {
  deletePaths: string[];
  itemPatches: ItemPatch[];
  clearClaimIds: string[];
  clearNoteTokens: string[];
};

export function retentionCutoff(now: Date, days = RETENTION_DAYS): Date {
  return new Date(now.getTime() - days * DAY_MS);
}

export function isStoragePath(value: unknown): value is string {
  return typeof value === "string" && value.startsWith("uploads/") && !value.includes("..") && !value.endsWith("/");
}

export function isAudioPath(path: string): boolean {
  return AUDIO.test(path);
}

export function planPhotoPurge(input: {
  orders: OrderRow[];
  items: ItemRow[];
  claims: ClaimRow[];
  notes: NoteRow[];
  objects: ObjectRow[];
  now: Date;
}): PurgePlan {
  const cutoff = retentionCutoff(input.now).getTime();
  const dueOrders = new Set(
    input.orders
      .filter((order) => (order.status === "delivered" || order.status === "cancelled") && Date.parse(order.updated_at) < cutoff)
      .map((order) => order.id),
  );
  const protect = new Set<string>();
  const drop = new Set<string>();
  const itemPatches: ItemPatch[] = [];
  const clearClaimIds: string[] = [];
  const noteSelfies = new Map<string, string>();

  const hold = (path: string) => {
    if (isStoragePath(path)) protect.add(path);
  };
  const release = (path: string) => {
    if (!isStoragePath(path)) return;
    if (isAudioPath(path)) protect.add(path);
    else drop.add(path);
  };

  for (const item of input.items) {
    const columnPaths = [item.photo_path, item.original_path, item.print_path];
    const nested = storageStrings(item.card).concat(storageStrings(item.voice));
    const due = dueOrders.has(item.order_id);
    for (const path of columnPaths) {
      if (!path) continue;
      if (due) release(path);
      else hold(path);
    }
    for (const path of nested) {
      if (due) release(path);
      else hold(path);
    }
    if (!due) continue;
    const patch: ItemPatch = { id: item.id };
    const card = stripImagePaths(item.card);
    const voice = stripImagePaths(item.voice);
    if (card.changed) patch.card = card.value;
    if (voice.changed) patch.voice = voice.value;
    const hasImage = [...columnPaths, ...nested].some((path) => isStoragePath(path) && !isAudioPath(path));
    if (hasImage || card.changed || voice.changed) itemPatches.push(patch);
  }

  for (const claim of input.claims) {
    if (!claim.photo_path) continue;
    if (dueOrders.has(claim.order_id)) {
      release(claim.photo_path);
      if (isStoragePath(claim.photo_path) && !isAudioPath(claim.photo_path)) clearClaimIds.push(claim.id);
    } else hold(claim.photo_path);
  }

  for (const note of input.notes) {
    if (note.storage_path) hold(note.storage_path);
    if (!note.selfie_path || !isStoragePath(note.selfie_path)) continue;
    const old = note.created_at ? Date.parse(note.created_at) < cutoff : false;
    if (old) {
      release(note.selfie_path);
      noteSelfies.set(note.token, note.selfie_path);
    } else hold(note.selfie_path);
  }

  for (const path of protect) drop.delete(path);

  for (const object of input.objects) {
    if (!object.createdAt || Date.parse(object.createdAt) >= cutoff) continue;
    if (!isStoragePath(object.path) || protect.has(object.path)) continue;
    drop.add(object.path);
  }

  return {
    deletePaths: [...drop].sort(),
    itemPatches: itemPatches.filter((patch) => {
      const item = input.items.find((row) => row.id === patch.id);
      if (!item) return false;
      const images = [item.photo_path, item.original_path, item.print_path, ...storageStrings(item.card), ...storageStrings(item.voice)].filter(
        (path): path is string => isStoragePath(path) && !isAudioPath(path),
      );
      return images.some((path) => drop.has(path));
    }),
    clearClaimIds: clearClaimIds.filter((id) => {
      const claim = input.claims.find((row) => row.id === id);
      return Boolean(claim?.photo_path && drop.has(claim.photo_path));
    }),
    clearNoteTokens: [...noteSelfies.entries()].filter(([, path]) => drop.has(path)).map(([token]) => token),
  };
}

export function storageStrings(value: unknown): string[] {
  const found: string[] = [];
  walk(value, found);
  return found;
}

function walk(value: unknown, found: string[]) {
  if (typeof value === "string") {
    if (isStoragePath(value)) found.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item, found);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) walk(item, found);
  }
}

export function stripImagePaths(value: unknown): { value: unknown; changed: boolean } {
  if (typeof value === "string") {
    if (isStoragePath(value) && !isAudioPath(value)) return { value: null, changed: true };
    return { value, changed: false };
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const stripped = stripImagePaths(item);
      changed = changed || stripped.changed;
      return stripped.value;
    });
    return { value: changed ? next : value, changed };
  }
  if (value && typeof value === "object") {
    let changed = false;
    const next: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      const stripped = stripImagePaths(item);
      changed = changed || stripped.changed;
      next[key] = stripped.value;
    }
    return { value: changed ? next : value, changed };
  }
  return { value, changed: false };
}
