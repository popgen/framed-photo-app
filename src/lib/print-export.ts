import type { CardSnapshot } from "./cards";
import type { TextOverlay } from "./overlay";
import type { Crop, Orientation } from "./print-size";

export async function downloadPrint(_args: {
  photoId: string;
  crop: Crop;
  printWcm: number;
  printHcm: number;
  orientation: Orientation;
  filename: string;
  overlay?: TextOverlay | null;
}): Promise<void> {
  throw new Error("La descarga para imprenta está disponible en la versión web.");
}

export async function downloadCardPdf(_card: CardSnapshot, _filename: string): Promise<void> {
  throw new Error("El PDF de la tarjeta está disponible en la versión web.");
}
