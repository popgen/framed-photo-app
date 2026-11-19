import { useState } from "react";
import { Text, View } from "react-native";
import { PhotoImport } from "./PhotoImport";
import { Button } from "./ui";
import { colors, font } from "./theme";
import type { ImportFlags } from "../lib/env";
import { pickAndSavePhotos, type PhotoSource } from "../lib/photos";

export function PhotoSources({
  onPhoto,
  onPhotos,
  onSample,
  multiple = false,
  print,
  flags,
  notice,
  returnTo = "/crear",
  deviceOnly = false,
}: {
  onPhoto: (photo: { id: string; width: number; height: number }) => Promise<void> | void;
  onPhotos?: (photos: { id: string; width: number; height: number }[]) => Promise<void> | void;
  onSample?: () => void;
  multiple?: boolean;
  print?: { printWcm: number; printHcm: number };
  flags?: ImportFlags;
  notice?: string;
  returnTo?: string;
  deviceOnly?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  async function deliver(saved: { id: string; width: number; height: number }[]) {
    if (!saved.length) return;
    if (onPhotos) await onPhotos(saved);
    else await onPhoto(saved[0]);
  }

  async function choose(source: PhotoSource) {
    setError(null);
    try {
      await deliver(await pickAndSavePhotos(multiple && source !== "camera", print, source));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos leer esa foto.");
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Button label={deviceOnly ? "Desde mi dispositivo" : "Desde mi dispositivo / galería"} onPress={() => void choose("gallery")} />
      <Button label="Tomar foto" tone="ghost" onPress={() => void choose("camera")} />
      {deviceOnly ? null : <Button label="Desde tu iPhone / iCloud" tone="ghost" onPress={() => void choose("icloud")} />}
      {onSample ? <Button label="Usar foto de ejemplo" tone="ghost" onPress={onSample} /> : null}
      {!deviceOnly && flags ? (
        <PhotoImport
          flags={flags}
          notice={notice}
          frame={print}
          returnTo={returnTo}
          onUse={async (photo) => deliver([photo])}
          onUseMany={onPhotos ? async (picked) => deliver(picked) : undefined}
        />
      ) : null}
      {error ? <Text style={{ fontFamily: font.medium, color: colors.bad }}>{error}</Text> : null}
    </View>
  );
}
