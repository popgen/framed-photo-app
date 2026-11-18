import { dataMode } from "./env";
import { readPhotoBlob } from "./photos";
import { getSupabase } from "./supabase";
import { selfieObjectPath } from "./selfie";
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

export async function uploadSelfie(blob: Blob): Promise<string | null> {
  if (dataMode() !== "supabase") return null;
  const path = selfieObjectPath();
  const { error } = await getSupabase().storage.from("photos").upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function uploadVoice(token: string, blob: Blob, extra?: { selfiePath?: string | null; senderName?: string | null }): Promise<string | null> {
  if (dataMode() !== "supabase") return null;
  const path = uploadObjectPath(blob.type || "audio/webm");
  const supabase = getSupabase();
  const { error } = await supabase.storage.from("photos").upload(path, blob, { contentType: blob.type || "audio/webm", upsert: false });
  if (error) throw new Error(error.message);
  const row = {
    token,
    storage_path: path,
    mime: blob.type || null,
    selfie_path: extra?.selfiePath || null,
    sender_name: extra?.senderName?.trim() || null,
  };
  let note = await supabase.from("voice_notes").insert(row);
  if (note.error && /selfie_path|sender_name|schema cache/i.test(note.error.message)) {
    note = await supabase.from("voice_notes").insert({ token, storage_path: path, mime: blob.type || null });
  }
  if (note.error) throw new Error(note.error.message);
  return path;
}

export async function attachVoiceSelfie(token: string, selfiePath: string | null, senderName?: string | null): Promise<void> {
  if (dataMode() !== "supabase") return;
  await fetch("/api/shop?op=voice-selfie", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, selfiePath, senderName: senderName ?? null }),
  });
}
