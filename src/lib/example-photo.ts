export const EXAMPLE_PHOTO_PROMPT = "Esta es la foto de ejemplo. Elige la tuya para continuar.";

export function isExamplePhoto(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith("asset:");
}

export function usesExamplePhoto(item: {
  photoId?: string | null;
  card?: { photos?: Record<string, string | null | undefined> } | null;
  collage?: { sources?: { photoId?: string | null }[] } | null;
}): boolean {
  if (isExamplePhoto(item.photoId)) return true;
  if (Object.values(item.card?.photos ?? {}).some((id) => isExamplePhoto(id))) return true;
  return (item.collage?.sources ?? []).some((source) => isExamplePhoto(source.photoId));
}
