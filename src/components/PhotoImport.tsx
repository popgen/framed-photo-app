import { useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Button } from "./ui";
import { colors, font } from "./theme";
import type { ImportFlags } from "../lib/env";
import { visibleImportSources } from "../lib/photo-import";
import { savePhotoPair } from "../lib/photos";

const LABELS = { instagram: "Instagram", facebook: "Facebook", google: "Google Photos" } as const;

function GoogleMark() {
  return (
    <Svg width={18} height={18} viewBox="0 0 48 48">
      <Path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <Path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <Path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <Path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </Svg>
  );
}

export function PhotoImport({
  flags,
  notice,
  frame,
  onUse,
  onUseMany,
  returnTo = "/crear",
}: {
  flags: ImportFlags;
  notice?: string;
  frame?: { printWcm: number; printHcm: number };
  onUse: (photo: { id: string; width: number; height: number }) => Promise<void>;
  onUseMany?: (photos: { id: string; width: number; height: number }[]) => Promise<void>;
  returnTo?: string;
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
    if (typeof window !== "undefined") window.location.href = `/api/imports/start?provider=${next}&next=${encodeURIComponent(returnTo)}`;
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

  async function chooseAll() {
    if (!onUseMany) return;
    setBusy("all");
    setMessage(null);
    try {
      const saved = [];
      for (const item of photos) {
        const response = await fetch(`/api/imports/file?id=${encodeURIComponent(item.id)}`);
        if (!response.ok) throw new Error("No pudimos traer una de las fotos.");
        saved.push(await savePhotoPair(await response.blob(), frame));
      }
      await onUseMany(saved);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No pudimos usar esas fotos.");
    } finally {
      setBusy(null);
    }
  }

  const sources = visibleImportSources(flags);
  if (!sources.length && !provider && !photos.length && !pickerUri && !message) return null;

  return (
    <View style={{ gap: 8 }}>
      {sources.map((item) => (
        <Button
          key={item}
          label={LABELS[item]}
          tone="ghost"
          icon={item === "google" ? <GoogleMark /> : undefined}
          surface={item === "google" ? "white" : undefined}
          onPress={() => start(item)}
        />
      ))}
      {pickerUri ? <Button label="Elegir en Google Fotos" tone="ghost" icon={<GoogleMark />} surface="white" onPress={() => { if (typeof window !== "undefined") window.open(pickerUri, "_blank"); }} /> : null}
      {onUseMany && photos.length > 1 ? <Button label="Agregar estas fotos" onPress={() => void chooseAll()} disabled={busy !== null} /> : null}
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
