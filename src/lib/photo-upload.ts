import { dataMode } from "./env";
import { readPhotoBlob } from "./photos";
import { getSupabase } from "./supabase";

export async function uploadOrderPhotos(photoId: string): Promise<{ original: string | null; print: string | null }> {
  if (!photoId || photoId.startsWith("asset:") || dataMode() !== "supabase") return { original: null, print: null };
  const stamp = crypto.randomUUID();
  const originalBlob = (await readPhotoBlob(`${photoId}:original`)) ?? (await readPhotoBlob(photoId));
  const printBlob = await readPhotoBlob(photoId);
  const supabase = getSupabase();
  let original: string | null = null;
  let print: string | null = null;
  if (originalBlob) {
    original = `uploads/${stamp}/original.jpg`;
    const { error } = await supabase.storage.from("photos").upload(original, originalBlob, { contentType: originalBlob.type || "image/jpeg", upsert: false });
    if (error) throw new Error(`No pudimos guardar la foto original: ${error.message}`);
  }
  if (printBlob) {
    print = `uploads/${stamp}/print.jpg`;
    const { error } = await supabase.storage.from("photos").upload(print, printBlob, { contentType: "image/jpeg", upsert: false });
    if (error) throw new Error(`No pudimos guardar la foto de imprenta: ${error.message}`);
  }
  return { original, print };
}

export async function uploadVoice(token: string, blob: Blob): Promise<string | null> {
  if (dataMode() !== "supabase") return null;
  const path = `uploads/voice/${token}`;
  const supabase = getSupabase();
  const { error } = await supabase.storage.from("photos").upload(path, blob, { contentType: blob.type || "audio/webm", upsert: true });
  if (error) throw new Error(error.message);
  await supabase.from("voice_notes").upsert({ token, storage_path: path, mime: blob.type });
  return path;
}
