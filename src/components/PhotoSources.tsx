import { useState } from "react";
import { Text, View } from "react-native";
import { PhotoImport } from "./PhotoImport";
import { Button } from "./ui";
import { colors, font } from "./theme";
import type { ImportFlags } from "../lib/env";
import { pickAndSavePhotos, type PhotoSource } from "../lib/photos";

export function PhotoSources({
  onPhoto,
  onSample,
  multiple = false,
  print,
  flags,
  notice,
}: {
  onPhoto: (photo: { id: string; width: number; height: number }) => Promise<void> | void;
  onSample?: () => void;
  multiple?: boolean;
  print?: { printWcm: number; printHcm: number };
  flags?: ImportFlags;
  notice?: string;
}) {
  const [error, setError] = useState<string | null>(null);

  async function choose(source: PhotoSource) {
    setError(null);
    try {
      const saved = await pickAndSavePhotos(multiple && source !== "camera", print, source);
      if (saved[0]) await onPhoto(saved[0]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos leer esa foto.");
    }
  }

  return (
    <View style={{ gap: 8 }}>
      <Button label="Desde mi dispositivo / galería" onPress={() => void choose("gallery")} />
      <Button label="Tomar foto" tone="ghost" onPress={() => void choose("camera")} />
      <Button label="Desde tu iPhone / iCloud" tone="ghost" onPress={() => void choose("icloud")} />
      {onSample ? <Button label="Usar foto de ejemplo" tone="ghost" onPress={onSample} /> : null}
      {flags ? <PhotoImport flags={flags} notice={notice} frame={print} onUse={async (photo) => onPhoto(photo)} /> : null}
      {error ? <Text style={{ fontFamily: font.medium, color: colors.bad }}>{error}</Text> : null}
    </View>
  );
}
