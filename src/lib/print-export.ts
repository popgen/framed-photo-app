import type { Crop, Orientation } from "./print-size";

export async function downloadPrint(_args: {
  photoId: string;
  crop: Crop;
  printWcm: number;
  printHcm: number;
  orientation: Orientation;
  filename: string;
}): Promise<void> {
  throw new Error("La descarga para imprenta está disponible en la versión web.");
}
