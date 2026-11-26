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
  const images = {
    front: await croppedPanel(card.photos.front, card.frontCrop),
    inside: await croppedPanel(card.photos.insideCenter ?? card.photos.insideLeft, card.insideCrop),
  };
  const bytes = await buildCardPdf(card, fonts, images);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([buffer], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function resolvePanelPhoto(id: string): Promise<{ uri?: string; source?: number } | null> {
  if (id.startsWith("uploads/")) {
    const { getRepo } = await import("./repo");
    try {
      const uri = await getRepo().signPhoto(id);
      return uri ? { uri } : null;
    } catch {
      return null;
    }
  }
  return resolvePhoto(id);
}

async function croppedPanel(id: string | null | undefined, crop?: Crop | null): Promise<Uint8Array | undefined> {
  if (!id || typeof document === "undefined") return undefined;
  const photo = await resolvePanelPhoto(id);
  if (!photo) throw new Error("No encontramos la foto de esta tarjeta en el servidor.");
  const asset = photo.source != null ? Image.resolveAssetSource(photo.source) : undefined;
  const uri = photo.uri ?? asset?.uri;
  if (!uri) throw new Error("No encontramos la foto de esta tarjeta en el servidor.");
  const image = await loadCardImage(uri);
  const sx = crop?.x ?? 0;
  const sy = crop?.y ?? 0;
  const sw = Math.max(1, crop?.width ?? image.naturalWidth);
  const sh = Math.max(1, crop?.height ?? image.naturalHeight);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sw));
  canvas.height = Math.max(1, Math.round(sh));
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) return undefined;
  return new Uint8Array(await blob.arrayBuffer());
}

function loadCardImage(uri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No pudimos preparar la foto de la tarjeta."));
    image.src = uri;
  });
}
