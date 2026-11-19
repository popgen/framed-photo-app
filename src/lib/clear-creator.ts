import { freshLayoutSeed, type TemplateId } from "./collage";
import { isExamplePhoto } from "./example-photo";
import type { Orientation } from "./print-size";
import { isVoiceDraftKey, voiceStorageKey } from "./voice";

export const CLEAR_PHOTOS_LABEL = "Borrar todo";
export const CLEAR_PHOTOS_MESSAGE = "¿Borrar todas las fotos? Esto no se puede deshacer.";
export const CLEAR_PHOTOS_CANCEL = "Cancelar";
export const CLEAR_PHOTOS_CONFIRM = "Borrar";

/** A cart line, only the fields that still need a local photo or voice draft. */
export type CartPhotoHold = {
  photoId?: string | null;
  voice?: { token?: string | null; audioId?: string | null; selfieId?: string | null } | null;
  collage?: { sources?: { photoId?: string | null }[] } | null;
  card?: { photos?: Record<string, string | null | undefined> | null } | null;
};

export type ForgetPlan = {
  forgetBlobIds: string[];
  forgetVoiceKeys: string[];
};

export type SingleEditorSnapshot = {
  frameId: string;
  orientation: Orientation;
  chip: string;
  photoId: string | null;
  overlayText: string | null;
  voiceToken: string | null;
  ack: boolean;
  sampleNote: string | null;
};

export type CollageEditorSnapshot = {
  frameId: string;
  templateId: TemplateId;
  orientation: Orientation;
  caption: string;
  layoutSeed: number;
  photoIds: string[];
  selected: number | null;
  ack: boolean;
  notice: string | null;
  note: string | null;
};

export function hasLoadedPhotos(ids: readonly (string | null | undefined)[]): boolean {
  return ids.some((id) => isUserPhoto(id));
}

/** Empty the single-photo editor. The frame, orientation and chip stay; the sample photo is the empty upload. */
export function clearSingleEditor(snapshot: SingleEditorSnapshot, examplePhotoId: string): SingleEditorSnapshot {
  return {
    frameId: snapshot.frameId,
    orientation: snapshot.orientation,
    chip: snapshot.chip,
    photoId: examplePhotoId,
    overlayText: null,
    voiceToken: null,
    ack: false,
    sampleNote: null,
  };
}

/** Empty the collage. Frame, layout, orientation and caption stay. The Mezclar seed is replaced. */
export function clearCollageEditor(snapshot: CollageEditorSnapshot, nextSeed: number): CollageEditorSnapshot {
  return {
    frameId: snapshot.frameId,
    templateId: snapshot.templateId,
    orientation: snapshot.orientation,
    caption: snapshot.caption,
    layoutSeed: nextSeed,
    photoIds: [],
    selected: null,
    ack: false,
    notice: null,
    note: null,
  };
}

/** A new Polaroid seed that is not the one Mezclar just used. */
export function nextLayoutSeed(current: number, random: () => number = freshLayoutSeed): number {
  const drawn = random() >>> 0;
  if (drawn && drawn !== (current >>> 0)) return drawn;
  return ((current >>> 0) + 0x9e3779b9) >>> 0 || 1;
}

/**
 * Local blobs and voice drafts to drop once the editor is empty.
 * Returns null when the user has not loaded a photo.
 * Ids still used by the cart are kept, including each photo's `:original` copy.
 */
export function planForget(input: {
  photoIds: readonly (string | null | undefined)[];
  extraIds?: readonly (string | null | undefined)[];
  voiceToken?: string | null;
  cart: readonly CartPhotoHold[];
}): ForgetPlan | null {
  if (!hasLoadedPhotos(input.photoIds)) return null;
  const held = heldBlobIds(input.cart);
  const heldTokens = new Set(input.cart.map((item) => item.voice?.token).filter((token): token is string => Boolean(token)));
  const forgetBlobIds = blobIdsFor([...input.photoIds, ...(input.extraIds ?? [])]).filter((id) => !held.has(id));
  const forgetVoiceKeys = input.voiceToken && !heldTokens.has(input.voiceToken) ? [voiceStorageKey(input.voiceToken)] : [];
  return { forgetBlobIds, forgetVoiceKeys };
}

/** Removes voice-draft keys only. Cart and other app keys are ignored. */
export function removeDraftKeys(keys: readonly string[], storage: { removeItem(key: string): void } | null | undefined): void {
  if (!storage) return;
  for (const key of keys) {
    if (!isVoiceDraftKey(key)) continue;
    storage.removeItem(key);
  }
}

function isUserPhoto(id: string | null | undefined): id is string {
  return Boolean(id) && !isExamplePhoto(id);
}

function blobIdsFor(ids: readonly (string | null | undefined)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push(id);
  };
  for (const id of ids) {
    if (!isUserPhoto(id)) continue;
    push(id);
    if (!id.endsWith(":original")) push(`${id}:original`);
  }
  return out;
}

function hold(set: Set<string>, id: string | null | undefined) {
  if (!isUserPhoto(id)) return;
  set.add(id);
  if (!id.endsWith(":original")) set.add(`${id}:original`);
}

export function heldBlobIds(items: readonly CartPhotoHold[]): Set<string> {
  const held = new Set<string>();
  for (const item of items) {
    hold(held, item.photoId);
    hold(held, item.voice?.audioId);
    hold(held, item.voice?.selfieId);
    for (const source of item.collage?.sources ?? []) hold(held, source.photoId);
    for (const id of Object.values(item.card?.photos ?? {})) hold(held, id);
  }
  return held;
}
