import { facebookPhotos, googlePhotos, instagramPhotos } from "../../src/lib/photo-import.ts";
import { sessionFrom } from "./shared.mjs";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method" });
    return;
  }
  const session = await sessionFrom(req);
  if (!session) {
    res.status(401).json({ error: "La conexión con tus fotos expiró. Vuelve a entrar." });
    return;
  }
  try {
    if (session.provider === "google") {
      const current = await googleSession(session.accessToken, session.sessionId);
      if (!current.mediaItemsSet) {
        res.status(200).json({ provider: "google", pickerUri: current.pickerUri || session.pickerUri || "", photos: [] });
        return;
      }
      const listed = await fetch(`https://photospicker.googleapis.com/v1/mediaItems?sessionId=${encodeURIComponent(session.sessionId)}`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
      });
      const json = await listed.json();
      res.status(200).json({ provider: "google", photos: googlePhotos(json).map(publicPhoto) });
      return;
    }
    if (session.provider === "instagram") {
      const listed = await fetch(`https://graph.instagram.com/me/media?fields=id,media_type,media_url&access_token=${encodeURIComponent(session.accessToken)}`);
      const json = await listed.json();
      res.status(200).json({ provider: "instagram", photos: instagramPhotos(json).map(publicPhoto) });
      return;
    }
    const listed = await fetch(`https://graph.facebook.com/v21.0/me/photos?type=uploaded&fields=id,images&access_token=${encodeURIComponent(session.accessToken)}`);
    const json = await listed.json();
    res.status(200).json({ provider: "facebook", photos: facebookPhotos(json).map(publicPhoto) });
  } catch (error) {
    console.warn("[mifotito] No se pudieron listar las fotos.", error instanceof Error ? error.message : error);
    res.status(502).json({ error: "No pudimos leer tus fotos." });
  }
}

function publicPhoto(photo) {
  return { id: photo.id, width: photo.width, height: photo.height };
}

async function googleSession(accessToken, sessionId) {
  const response = await fetch(`https://photospicker.googleapis.com/v1/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("session");
  return response.json();
}
