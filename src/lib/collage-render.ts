import type { CollageSnapshot } from "./collage";

export async function renderCollageBlob(_snapshot: CollageSnapshot, _images: unknown[]): Promise<Blob> {
  throw new Error("La composición del collage está disponible en la versión web.");
}
