import { facebookPhotos, googlePhotos, instagramPhotos } from "../../src/lib/photo-import.ts";
import { sessionFrom } from "./shared.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method" });
    return;
  }
  const session = await sessionFrom(req);
  const id = String(req.query?.id || "");
  if (!session || !id) {
    res.status(401).json({ error: "La conexión con tus fotos expiró. Vuelve a entrar." });
    return;
  }
  const size = req.query?.size === "thumb" ? "thumb" : "full";
  try {
    const photos = await loadPhotos(session);
    const photo = photos.find((item) => item.id === id);
    if (!photo) {
      res.status(404).json({ error: "No encontramos esa foto." });
      return;
    }
    const headers = session.provider === "google" ? { Authorization: `Bearer ${session.accessToken}` } : {};
    const response = await fetch(size === "thumb" ? photo.thumbUrl : photo.url, { headers });
    if (!response.ok) throw new Error("download");
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > 12 * 1024 * 1024) {
      res.status(413).json({ error: "Esa foto pesa más de lo que podemos traer." });
      return;
    }
    const type = response.headers.get("content-type") || "image/jpeg";
    res.bytes(bytes, type.startsWith("image/") ? type : "image/jpeg");
  } catch (error) {
    console.warn("[mifotito] No se pudo descargar la foto.", error instanceof Error ? error.message : error);
    res.status(502).json({ error: "No pudimos descargar esa foto." });
  }
}

async function loadPhotos(session) {
  if (session.provider === "google") {
    const listed = await fetch(`https://photospicker.googleapis.com/v1/mediaItems?sessionId=${encodeURIComponent(session.sessionId)}`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    });
    return googlePhotos(await listed.json());
  }
  if (session.provider === "instagram") {
    const listed = await fetch(`https://graph.instagram.com/me/media?fields=id,media_type,media_url&access_token=${encodeURIComponent(session.accessToken)}`);
    return instagramPhotos(await listed.json());
  }
  const listed = await fetch(`https://graph.facebook.com/v21.0/me/photos?type=uploaded&fields=id,images&access_token=${encodeURIComponent(session.accessToken)}`);
  return facebookPhotos(await listed.json());
}
