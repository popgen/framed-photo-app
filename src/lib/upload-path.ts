export function extensionForMime(mime: string): string {
  const type = mime.toLowerCase();
  if (type.includes("png")) return "png";
  if (type.includes("webp")) return "webp";
  if (type.includes("heic")) return "heic";
  if (type.includes("heif")) return "heif";
  if (type.includes("pdf")) return "pdf";
  if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) return "m4a";
  if (type.includes("ogg")) return "ogg";
  if (type.includes("wav")) return "wav";
  if (type.includes("webm")) return "webm";
  return "jpg";
}

export function uploadObjectPath(mime: string): string {
  return `uploads/${crypto.randomUUID()}.${extensionForMime(mime)}`;
}
