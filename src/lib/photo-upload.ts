import { dataMode } from "./env";
import { readPhotoBlob } from "./photos";
import { getSupabase } from "./supabase";
import { uploadObjectPath } from "./upload-path";

export async function uploadOrderPhotos(photoId: string): Promise<{ original: string | null; print: string | null }> {
  if (!photoId || photoId.startsWith("asset:") || dataMode() !== "supabase") return { original: null, print: null };
  const originalBlob = (await readPhotoBlob(`${photoId}:original`)) ?? (await readPhotoBlob(photoId));
  const printBlob = await readPhotoBlob(photoId);
  const supabase = getSupabase();
  let original: string | null = null;
  let print: string | null = null;
  if (originalBlob) {
    original = uploadObjectPath(originalBlob.type || "image/jpeg");
    const { error } = await supabase.storage.from("photos").upload(original, originalBlob, { contentType: originalBlob.type || "image/jpeg", upsert: false });
    if (error) throw new Error(`No pudimos guardar la foto original: ${error.message}`);
  }
  if (printBlob && printBlob !== originalBlob) {
    print = uploadObjectPath("image/jpeg");
    const { error } = await supabase.storage.from("photos").upload(print, printBlob, { contentType: "image/jpeg", upsert: false });
    if (error) throw new Error(`No pudimos guardar la foto de imprenta: ${error.message}`);
  } else {
    print = original;
  }
  return { original, print };
}

export async function uploadVoice(token: string, blob: Blob): Promise<string | null> {
  if (dataMode() !== "supabase") return null;
  const path = uploadObjectPath(blob.type || "audio/webm");
  const supabase = getSupabase();
  const { error } = await supabase.storage.from("photos").upload(path, blob, { contentType: blob.type || "audio/webm", upsert: false });
  if (error) throw new Error(error.message);
  const note = await supabase.from("voice_notes").insert({ token, storage_path: path, mime: blob.type || null });
  if (note.error) throw new Error(note.error.message);
  return path;
}
