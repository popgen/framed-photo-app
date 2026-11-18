import { Image } from "react-native";
import { resolvePhoto } from "./photos";
import { targetPixels, type Crop, type Orientation } from "./print-size";

export async function downloadPrint(args: {
  photoId: string;
  crop: Crop;
  printWcm: number;
  printHcm: number;
  orientation: Orientation;
  filename: string;
}): Promise<void> {
  const photo = await resolvePhoto(args.photoId);
  if (!photo) throw new Error("No encontramos la foto de este pedido.");
  const asset = photo.source != null ? Image.resolveAssetSource(photo.source) : undefined;
  const resolved = photo.uri ?? asset?.uri;
  if (!resolved) throw new Error("No encontramos la foto de este pedido.");
  const uri = resolved;
  const image = new window.Image();
  image.crossOrigin = "anonymous";
  image.src = uri;
  await image.decode();
  const target = targetPixels(args.printWcm, args.printHcm, args.orientation);
  const canvas = document.createElement("canvas");
  canvas.width = target.width;
  canvas.height = target.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El navegador no pudo preparar el archivo.");
  ctx.drawImage(image, args.crop.x, args.crop.y, args.crop.width, args.crop.height, 0, 0, target.width, target.height);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((value) => (value ? resolve(value) : reject(new Error("No se pudo exportar."))), "image/jpeg", 0.92);
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = args.filename;
  link.click();
  URL.revokeObjectURL(url);
}
