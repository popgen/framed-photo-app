import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, useWindowDimensions, View } from "react-native";
import { FrameView } from "../components/FrameView";
import { PriceTicker } from "../components/fx";
import { Button, Card, Screen, TabBar } from "../components/ui";
import { colors, font } from "../components/theme";
import { frameById } from "../lib/catalog";
import { uid } from "../lib/ids";
import { pickAndSavePhotos, samplePhoto } from "../lib/photos";
import { quote } from "../lib/pricing";
import { aspectParts } from "../lib/catalog";
import { assessResolution, centeredCrop } from "../lib/print-size";
import { useCart } from "../lib/store";
import { walls } from "../lib/walls";

export default function Muro() {
  const { width } = useWindowDimensions();
  const [layout, setLayout] = useState(walls[0]);
  const [finish, setFinish] = useState(walls[0].finishes[0]);
  const [photos, setPhotos] = useState<{ id: string; width: number; height: number }[]>([]);
  const addMany = useCart((state) => state.addMany);
  const stage = Math.min(width, 480) - 32;
  const priced = quote({ items: finish.frames.map((id) => ({ unitPriceCents: frameById(id).priceCents })) });

  function selectLayout(next: (typeof walls)[number]) {
    setLayout(next);
    setFinish(next.finishes[0]);
    setPhotos([]);
  }

  return (
    <Screen
      footer={
        <View>
          <View style={{ padding: 16, gap: 8, backgroundColor: colors.bg }}>
            <PriceTicker cents={priced.totalCents} />
            <Button
              label="Agregar el set"
              disabled={photos.length < finish.frames.length}
              onPress={() => {
                const bundleId = uid("bd_");
                addMany(
                  finish.frames.map((frameId, index) => {
                    const frame = frameById(frameId);
                    const photo = photos[index];
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
                    };
                  }),
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
        <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Muro</Text>
        <Text style={{ fontFamily: font.body, color: colors.muted }}>Elige el conjunto, suelta una foto en cada lugar y míralo en la pared.</Text>
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
            {finish.frames.map((frameId, index) => (
              <Pressable key={`${frameId}-${index}`} onPress={() => void fillSlot(index, photos, setPhotos)} style={{ width: layout.id === "mixed" && index === 1 ? stage * 0.42 : stage * 0.28 }}>
                <FrameView frame={frameById(frameId)} photoId={photos[index]?.id} crop={photos[index] ? centeredCrop(photos[index].width, photos[index].height, ...aspectParts(frameById(frameId), "portrait")) : null} width={layout.id === "mixed" && index === 1 ? stage * 0.4 : stage * 0.26} />
              </Pressable>
            ))}
          </View>
        </Card>
        <Button
          label="Llenar con fotos"
          onPress={async () => {
            const picked = await pickAndSavePhotos(true);
            if (!picked.length) return;
            const next = finish.frames.map((_, index) => picked[index] ?? photos[index]).filter(Boolean) as typeof photos;
            setPhotos(next);
          }}
        />
        <Button label="Usar fotos de ejemplo" tone="ghost" onPress={() => setPhotos(finish.frames.map(() => samplePhoto()))} />
        {priced.frameDiscountLabel ? <Text style={{ fontFamily: font.medium, color: colors.pine }}>{priced.frameDiscountLabel}</Text> : null}
      </View>
    </Screen>
  );
}

async function fillSlot(
  index: number,
  photos: { id: string; width: number; height: number }[],
  setPhotos: (value: { id: string; width: number; height: number }[]) => void,
) {
  const picked = await pickAndSavePhotos(false);
  if (!picked[0]) return;
  const next = photos.slice();
  next[index] = picked[0];
  setPhotos(next);
}
