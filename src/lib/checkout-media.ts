import type { CardPhotos, CardSnapshot } from "./cards";

const CARD_PHOTO_SLOTS: (keyof CardPhotos)[] = ["front", "back", "flap", "insideLeft", "insideCenter", "insideRight"];

export type UploadedPhotoPaths = { original: string | null; print: string | null };

type CollageSource = { photoId?: string; storagePath?: string | null };

export type CheckoutMediaItem = {
  testProduct?: boolean;
  photoId?: string;
  collage?: ({ sources: CollageSource[] } & Record<string, unknown>) | null;
  card?: CardSnapshot | null;
};

/** Uploads local photo IDs (frames, collage sources, Christmas card panels) and returns storage paths. */
export async function attachStorageToCheckoutItem<T extends CheckoutMediaItem>(
  item: T,
  upload: (photoId: string) => Promise<UploadedPhotoPaths>,
): Promise<T & { photoOriginalPath: string | null; photoPrintPath: string | null }> {
  if (item.testProduct) {
    return { ...item, photoOriginalPath: null, photoPrintPath: null };
  }
  const cache = new Map<string, UploadedPhotoPaths>();
  const uploadOnce = async (photoId: string): Promise<UploadedPhotoPaths> => {
    if (!photoId) return { original: null, print: null };
    if (photoId.startsWith("uploads/")) return { original: photoId, print: photoId };
    const hit = cache.get(photoId);
    if (hit) return hit;
    const uploaded = await upload(photoId);
    cache.set(photoId, uploaded);
    return uploaded;
  };

  let paths = { ...(await uploadOnce(item.photoId || "")) };
  let collage = item.collage ?? null;
  if (collage) {
    const sources = [];
    for (const source of collage.sources) {
      if (source.storagePath) {
        sources.push(source);
        continue;
      }
      const uploaded = await uploadOnce(source.photoId || "");
      sources.push({ ...source, storagePath: uploaded.original || uploaded.print });
    }
    collage = { ...collage, sources };
  }
  let card = item.card ?? null;
  if (card?.photos) {
    const nextPhotos: CardPhotos = { ...card.photos };
    for (const slot of CARD_PHOTO_SLOTS) {
      const id = nextPhotos[slot];
      if (!id) continue;
      const uploaded = await uploadOnce(id);
      const path = uploaded.original || uploaded.print;
      if (path) nextPhotos[slot] = path;
    }
    card = { ...card, photos: nextPhotos };
    if (!paths.original && !paths.print && nextPhotos.front?.startsWith("uploads/")) {
      paths = { original: nextPhotos.front, print: nextPhotos.front };
    }
  }
  return { ...item, collage, card, photoOriginalPath: paths.original, photoPrintPath: paths.print };
}
