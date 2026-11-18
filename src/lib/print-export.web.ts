import { Asset } from "expo-asset";
import { AmaticSC_700Bold } from "@expo-google-fonts/amatic-sc";
import { DancingScript_600SemiBold } from "@expo-google-fonts/dancing-script";
import { GreatVibes_400Regular } from "@expo-google-fonts/great-vibes";
import { Lobster_400Regular } from "@expo-google-fonts/lobster";
import { Pacifico_400Regular } from "@expo-google-fonts/pacifico";
import { Satisfy_400Regular } from "@expo-google-fonts/satisfy";
import { Image } from "react-native";
import type { CardSnapshot } from "./cards";
import { fontById, type TextOverlay } from "./overlay";
import { resolvePhoto } from "./photos";
import { targetPixels, type Crop, type Orientation } from "./print-size";

export async function downloadPrint(args: {
  photoId: string;
  crop: Crop;
  printWcm: number;
  printHcm: number;
  orientation: Orientation;
  filename: string;
  overlay?: TextOverlay | null;
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
  if (args.overlay?.text) {
    const family = fontById(args.overlay.font).family;
    const size = Math.max(12, args.overlay.size * target.height);
    ctx.fillStyle = args.overlay.color;
    ctx.font = `${size}px ${family}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(args.overlay.text, args.overlay.x * target.width, args.overlay.y * target.height);
  }
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

const FONT_MODULES = {
  pacifico: Pacifico_400Regular,
  dancing: DancingScript_600SemiBold,
  vibes: GreatVibes_400Regular,
  lobster: Lobster_400Regular,
  satisfy: Satisfy_400Regular,
  amatic: AmaticSC_700Bold,
} as const;

export async function downloadCardPdf(card: CardSnapshot, filename: string): Promise<void> {
  const fonts: Record<string, Uint8Array> = {};
  for (const [id, moduleId] of Object.entries(FONT_MODULES)) {
    const asset = Asset.fromModule(moduleId);
    await asset.downloadAsync();
    const response = await fetch(asset.localUri ?? asset.uri);
    fonts[id] = new Uint8Array(await response.arrayBuffer());
  }
  const { buildCardPdf } = await import("./card-pdf");
  const bytes = await buildCardPdf(card, fonts);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
