import { dataMode } from "./env";
import { readPhotoBlob } from "./photos";
import { getSupabase } from "./supabase";
import { uploadObjectPath } from "./upload-path";

export { extensionForMime, uploadObjectPath } from "./upload-path";

export async function uploadOrderPhotos(photoId: string): Promise<{ original: string | null; print: string | null }> {
  if (!photoId || photoId.startsWith("asset:") || dataMode() !== "supabase") return { original: null, print: null };
  const blob = (await readPhotoBlob(photoId)) ?? (await readPhotoBlob(`${photoId}:original`));
  if (!blob) return { original: null, print: null };
  const path = uploadObjectPath(blob.type || "image/jpeg");
  const { error } = await getSupabase().storage.from("photos").upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
  if (error) throw new Error(`No pudimos guardar la foto: ${error.message}`);
  return { original: null, print: path };
}

export async function uploadVoice(token: string, blob: Blob): Promise<string | null> {
  if (dataMode() !== "supabase") return null;
  const path = uploadObjectPath(blob.type || "audio/webm");
  const supabase = getSupabase();
  const { error } = await supabase.storage.from("photos").upload(path, blob, { contentType: blob.type || "audio/webm", upsert: false });
  if (error) throw new Error(error.message);
  await supabase.from("voice_notes").insert({ token, storage_path: path, mime: blob.type || null });
  return path;
}
