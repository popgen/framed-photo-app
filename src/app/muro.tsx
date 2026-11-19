import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { FrameView } from "../components/FrameView";
import { PhotoSources } from "../components/PhotoSources";
import { TextStyleEditor } from "../components/TextStyleEditor";
import { PriceTicker } from "../components/fx";
import { Button, Card, Screen, TabBar } from "../components/ui";
import { colors, font } from "../components/theme";
import { frameById } from "../lib/catalog";
import { uid } from "../lib/ids";
import { pickAndSavePhotos, samplePhoto } from "../lib/photos";
import { importFlags } from "../lib/env";
import { quote } from "../lib/pricing";
import { aspectParts } from "../lib/catalog";
import { assessResolution, centeredCrop } from "../lib/print-size";
import { serializeOverlay, type TextOverlay } from "../lib/overlay";
import { useCart } from "../lib/store";
import { fillEmptyWallSlots, replaceWallSlot, wallPhotosReady, type WallSlotPhoto } from "../lib/wall-slots";
import { walls } from "../lib/walls";

export default function Muro() {
  const { width } = useWindowDimensions();
  const [layout, setLayout] = useState(walls[0]);
  const [finish, setFinish] = useState(walls[0].finishes[0]);
  const [photos, setPhotos] = useState<(WallSlotPhoto | null)[]>([]);
  const [overlays, setOverlays] = useState<(TextOverlay | null)[]>([]);
  const [slot, setSlot] = useState(0);
  const addMany = useCart((state) => state.addMany);
  const stage = Math.min(width, 480) - 32;
  const priced = quote({ items: finish.frames.map((id) => ({ unitPriceCents: frameById(id).priceCents })) });
  const ready = wallPhotosReady(photos, finish.frames.length);

  function selectLayout(next: (typeof walls)[number]) {
    setLayout(next);
    setFinish(next.finishes[0]);
    setPhotos([]);
    setOverlays([]);
    setSlot(0);
  }

  function chooseFrame(index: number) {
    setSlot(index);
  }

  function putSaved(index: number, photo: { id: string; width: number; height: number }) {
    setSlot(index);
    setPhotos((current) => replaceWallSlot(current, index, photo));
  }

  return (
    <Screen
      footer={
        <View>
          <View style={{ padding: 16, gap: 8, backgroundColor: colors.bg }}>
            <PriceTicker cents={priced.totalCents} />
            <Button
              label="Agregar el set"
              disabled={!ready}
              onPress={() => {
                if (!ready) return;
                const bundleId = uid("bd_");
                addMany(
                  finish.frames.map((frameId, index) => {
                    const frame = frameById(frameId);
                    const photo = photos[index];
                    if (!photo) return null;
                    const [aw, ah] = aspectParts(frame, "portrait");
                    const crop = centeredCrop(photo.width, photo.height, aw, ah);
                    const assessed = assessResolution({
                      cropWidthPx: crop.width,
                      cropHeightPx: crop.height,
                      printWcm: frame.printWcm,
                      printHcm: frame.printHcm,
                      orientation: "portrait",
                    });
                    return {
                      id: uid("ci_"),
                      frameId,
                      photoId: photo.id,
                      crop,
                      orientation: "portrait" as const,
                      dpi: Math.round(assessed.dpi),
                      resolutionStatus: assessed.status,
                      bundleId,
                      bundleLabel: layout.name,
                      textOverlay: serializeOverlay(overlays[index]),
                    };
                  }).filter((item): item is NonNullable<typeof item> => item !== null),
                );
                router.push("/carrito");
              }}
            />
          </View>
          <TabBar />
        </View>
      }
    >
      <View style={{ padding: 16, gap: 12 }}>
        <Text accessibilityRole="header" style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Cuadros con fotos</Text>
        <Text style={{ fontFamily: font.body, color: colors.muted }}>Elige el conjunto, suelta una foto en cada lugar y míralo en la pared. Es decoración del hogar: arte de pared con tus fotos, varios cuadros en vez de un collage impreso.</Text>
        <View style={{ gap: 8 }}>
          {walls.map((item) => (
            <Pressable key={item.id} onPress={() => selectLayout(item)} style={{ minHeight: 52, justifyContent: "center", padding: 12, borderRadius: 16, backgroundColor: layout.id === item.id ? colors.ink : colors.white }}>
              <Text style={{ fontFamily: font.semibold, color: layout.id === item.id ? "white" : colors.ink }}>{item.name}</Text>
              <Text style={{ fontFamily: font.body, color: layout.id === item.id ? "#F6E4DC" : colors.muted }}>{item.description}</Text>
            </Pressable>
          ))}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {layout.finishes.map((item) => (
            <Pressable key={item.id} onPress={() => setFinish(item)} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", backgroundColor: finish.id === item.id ? colors.red : colors.white }}>
              <Text style={{ fontFamily: font.semibold, color: finish.id === item.id ? "white" : colors.ink }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        <Card>
          <View style={{ backgroundColor: "#E7D9CC", borderRadius: 18, minHeight: 280, padding: 12, flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 8 }}>
            {finish.frames.map((frameId, index) => {
              const photo = photos[index] ?? null;
              const frame = frameById(frameId);
              const wide = layout.id === "mixed" && index === 1;
              const selected = slot === index;
              return (
                <Pressable
                  key={`${finish.id}-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={photo ? `Marco ${index + 1}, cambiar foto` : `Marco ${index + 1}, agrega foto`}
                  accessibilityState={{ selected }}
                  onPress={() => chooseFrame(index)}
                  style={{ width: wide ? stage * 0.42 : stage * 0.28, borderWidth: selected ? 3 : 0, borderColor: colors.red, borderRadius: 10, padding: selected ? 2 : 0 }}
                >
                  <FrameView frame={frame} photoId={photo?.id} crop={photo ? centeredCrop(photo.width, photo.height, ...aspectParts(frame, "portrait")) : null} width={wide ? stage * 0.4 : stage * 0.26} overlay={overlays[index]} onOverlayChange={(next) => setOverlays((current) => replaceWallSlot(current, index, next))} />
                  {photo ? null : (
                    <View pointerEvents="none" style={{ position: "absolute", left: 4, right: 4, top: "36%", alignItems: "center" }}>
                      <Text style={{ fontFamily: font.bold, fontSize: 13, color: colors.ink, textAlign: "center", backgroundColor: "rgba(255,252,249,0.92)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>+ Agrega foto</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </Card>
        <Text style={{ fontFamily: font.semibold, color: colors.ink, textAlign: "center" }}>Foto del marco {slot + 1}</Text>
        {photos[slot] ? (
          <Button label={`Quitar foto del marco ${slot + 1}`} tone="ghost" onPress={() => setPhotos((current) => replaceWallSlot(current, slot, null))} />
        ) : (
          <Text style={{ fontFamily: font.medium, color: colors.muted, textAlign: "center" }}>Toca un marco para elegir su foto.</Text>
        )}
        <PhotoSources flags={importFlags()} onPhoto={(photo) => putSaved(slot, photo)} />
        <Button
          label="Llenar todos"
          tone="ghost"
          onPress={async () => {
            const picked = await pickAndSavePhotos(true);
            if (!picked.length) return;
            setPhotos((current) => fillEmptyWallSlots(current, finish.frames.length, picked));
          }}
        />
        <Button label="Usar fotos de ejemplo" tone="ghost" onPress={() => setPhotos(finish.frames.map(() => samplePhoto()))} />
        {photos[slot] ? (
          <Card>
            <TextStyleEditor label={`Texto en la foto ${slot + 1}`} value={overlays[slot] ?? null} onChange={(next) => setOverlays((current) => replaceWallSlot(current, slot, next))} maxChars={48} />
          </Card>
        ) : null}
        {priced.frameDiscountLabel ? <Text style={{ fontFamily: font.medium, color: colors.pine }}>{priced.frameDiscountLabel}</Text> : null}
      </View>
    </Screen>
  );
}
