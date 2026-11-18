import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { Button } from "./ui";
import { colors, font } from "./theme";
import type { ImportFlags } from "../lib/env";
import { savePhotoPair } from "../lib/photos";

const LABELS = { instagram: "Instagram", facebook: "Facebook", google: "Google Photos" } as const;

export function PhotoImport({
  flags,
  notice,
  frame,
  onUse,
}: {
  flags: ImportFlags;
  notice?: string;
  frame?: { printWcm: number; printHcm: number };
  onUse: (photo: { id: string; width: number; height: number }) => Promise<void>;
}) {
  const provider = notice === "instagram" || notice === "facebook" || notice === "google" ? notice : null;
  const [photos, setPhotos] = useState<{ id: string; width: number; height: number }[]>([]);
  const [pickerUri, setPickerUri] = useState("");
  const [message, setMessage] = useState<string | null>(notice === "error" ? "No pudimos conectar esa cuenta. Revisa la configuración e inténtalo otra vez." : null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!provider) return;
    let stop = false;
    async function load() {
      const response = await fetch("/api/imports/list");
      const json = (await response.json()) as { photos?: { id: string; width: number; height: number }[]; pickerUri?: string; error?: string };
      if (stop) return;
      if (!response.ok) {
        setMessage(json.error || "No pudimos leer tus fotos.");
        return;
      }
      setPhotos(json.photos ?? []);
      setPickerUri(json.pickerUri || "");
    }
    void load();
    const timer = provider === "google" ? setInterval(() => void load(), 3000) : undefined;
    return () => {
      stop = true;
      if (timer) clearInterval(timer);
    };
  }, [provider]);

  function start(next: "instagram" | "facebook" | "google") {
    if (typeof window !== "undefined") window.location.href = `/api/imports/start?provider=${next}`;
  }

  async function choose(id: string) {
    setBusy(id);
    setMessage(null);
    try {
      const response = await fetch(`/api/imports/file?id=${encodeURIComponent(id)}`);
      if (!response.ok) {
        const json = (await response.json().catch(() => ({}))) as { error?: string };
        setMessage(json.error || "No pudimos descargar esa foto.");
        return;
      }
      const saved = await savePhotoPair(await response.blob(), frame);
      await onUse(saved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos usar esa foto.");
    } finally {
      setBusy(null);
    }
  }

  const buttons = [
    flags.instagram ? "instagram" : null,
    flags.facebook ? "facebook" : null,
    flags.googlePhotos ? "google" : null,
  ].filter((item): item is "instagram" | "facebook" | "google" => Boolean(item));

  if (!buttons.length && !provider && !message) return null;

  return (
    <View style={{ gap: 8 }}>
      {buttons.map((item) => (
        <Button key={item} label={LABELS[item]} tone="ghost" onPress={() => start(item)} />
      ))}
      {pickerUri ? <Button label="Elegir en Google Fotos" tone="ghost" onPress={() => { if (typeof window !== "undefined") window.open(pickerUri, "_blank"); }} /> : null}
      {photos.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {photos.map((item) => (
            <Pressable key={item.id} onPress={() => void choose(item.id)} disabled={busy !== null} style={{ width: 96, gap: 4 }}>
              <Image source={{ uri: `/api/imports/file?id=${encodeURIComponent(item.id)}&size=thumb` }} style={{ width: 96, height: 96, borderRadius: 12, backgroundColor: colors.line }} />
              <Text style={{ fontFamily: font.medium, color: colors.ink, fontSize: 12, textAlign: "center" }}>{busy === item.id ? "Trayendo…" : "Usar esta"}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {message ? <Text style={{ fontFamily: font.medium, color: colors.bad }}>{message}</Text> : null}
    </View>
  );
}
