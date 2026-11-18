import { Platform } from "react-native";
import samples from "../../data/samples.json";
import { uid } from "./ids";

const SAMPLE_SOURCES = {
  sample: require("../../assets/sample-memory.png"),
  "sample-small": require("../../assets/sample-small.png"),
} as const;

type SampleKey = keyof typeof SAMPLE_SOURCES;

const memory = new Map<string, { url: string; width: number; height: number }>();

export function assetInfo(id: string): { source: number; width: number; height: number } | null {
  if (!id.startsWith("asset:")) return null;
  const key = id.slice("asset:".length) as SampleKey;
  const source = SAMPLE_SOURCES[key];
  const size = samples[key];
  if (!source || !size) return null;
  return { source, width: size.width, height: size.height };
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("recuerdo", 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("photos")) database.createObjectStore("photos");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function measure(blob: Blob): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(blob);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  }
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = () => reject(new Error("No pudimos leer la foto."));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function savePhotoBlob(blob: Blob): Promise<{ id: string; width: number; height: number }> {
  const id = uid("ph_");
  const size = await measure(blob);
  if (typeof indexedDB !== "undefined") {
    const database = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction("photos", "readwrite");
      tx.objectStore("photos").put(blob, id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  memory.set(id, { url: URL.createObjectURL(blob), ...size });
  return { id, ...size };
}

export async function resolvePhoto(id: string): Promise<{ uri?: string; source?: number } | null> {
  const asset = assetInfo(id);
  if (asset) return { source: asset.source };
  const cached = memory.get(id);
  if (cached) return { uri: cached.url };
  if (typeof indexedDB === "undefined") return null;
  const database = await openDb();
  const blob = await new Promise<Blob | undefined>((resolve, reject) => {
    const tx = database.transaction("photos", "readonly");
    const request = tx.objectStore("photos").get(id);
    request.onsuccess = () => resolve(request.result as Blob | undefined);
    request.onerror = () => reject(request.error);
  });
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  const size = await measure(blob);
  memory.set(id, { url, ...size });
  return { uri: url };
}

export function samplePhoto(kind: "sample" | "sample-small" = "sample"): { id: string; width: number; height: number } {
  const info = assetInfo(`asset:${kind}`);
  if (!info) throw new Error("No está la foto de ejemplo.");
  return { id: `asset:${kind}`, width: info.width, height: info.height };
}

export function pickPhotoFiles(multiple = false): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,.heic,.heif";
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}

export async function pickAndSavePhotos(multiple = false): Promise<{ id: string; width: number; height: number }[]> {
  if (Platform.OS === "web") {
    const files = await pickPhotoFiles(multiple);
    const saved = [];
    for (const file of files) saved.push(await savePhotoBlob(await resizeForPrint(await fileToJpegBlob(file))));
    return saved;
  }
  const ImagePicker = await import("expo-image-picker");
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
    allowsMultipleSelection: multiple,
  });
  if (result.canceled) return [];
  const saved = [];
  for (const asset of result.assets) {
    const response = await fetch(asset.uri);
    saved.push(await savePhotoBlob(await response.blob()));
  }
  return saved;
}

const MAX_PRINT_EDGE = 4724;

export async function resizeForPrint(blob: Blob): Promise<Blob> {
  if (typeof document === "undefined" || typeof createImageBitmap !== "function") return blob;
  const bitmap = await createImageBitmap(blob);
  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = Math.min(1, MAX_PRINT_EDGE / longest);
  const shrink = scale < 1 || blob.size > 1_800_000;
  if (!shrink) {
    bitmap.close();
    return blob;
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return blob;
  }
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const output = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  return output ?? blob;
}

export async function fileToJpegBlob(file: File): Promise<Blob> {
  const name = file.name.toLowerCase();
  const heic = name.endsWith(".heic") || name.endsWith(".heif") || file.type === "image/heic" || file.type === "image/heif";
  if (!heic) return file;
  const heic2any = (await import("heic2any")).default;
  const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  return Array.isArray(converted) ? converted[0] : converted;
}
