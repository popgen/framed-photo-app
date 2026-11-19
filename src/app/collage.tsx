import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { CollageBoard } from "../components/CollageBoard";
import { FrameView } from "../components/FrameView";
import { PhotoSources } from "../components/PhotoSources";
import { useRepo } from "../components/provider";
import { PriceTicker, useReducedMotion } from "../components/fx";
import { Banner, Button, Card, Field, Screen, TabBar } from "../components/ui";
import { colors, font } from "../components/theme";
import { frameById } from "../lib/catalog";
import {
  COLLAGE_MIN_PHOTOS,
  TEMPLATES,
  assessCells,
  buildSnapshot,
  cropsForCells,
  framedPriceCents,
  fullFrameCrop,
  arrangeIndexes,
  cellCentimeters,
  layoutCells,
  mergePhotoCount,
  previewCount,
  printAspect,
  resolveLayout,
  swapped,
  zoomCrop,
  type CollageSpacing,
  type TemplateId,
} from "../lib/collage";
import { renderCollageBlob } from "../lib/collage-render";
import { frameStage, frameWidthForBox } from "../lib/frame-stage";
import { EXAMPLE_PHOTO_PROMPT, isExamplePhoto } from "../lib/example-photo";
import { stockChecksEnabled } from "../lib/env";
import { uid } from "../lib/ids";
import { resolvePhoto, savePhotoBlob } from "../lib/photos";
import type { Crop, Orientation } from "../lib/print-size";
import { useCart } from "../lib/store";

type Slot = { photoId: string; width: number; height: number; crop: Crop };
type PhotoSource = { uri?: string; source?: number } | null;

function withCrops(
  slots: Slot[],
  templateId: TemplateId,
  frame: { printWcm: number; printHcm: number },
  orientation: Orientation,
  spacing: CollageSpacing,
  caption: string,
): Slot[] {
  if (slots.length < COLLAGE_MIN_PHOTOS) return slots;
  const aspect = printAspect(frame.printWcm, frame.printHcm, orientation);
  const cells = layoutCells({ templateId, count: slots.length, spacing, caption, aspectW: aspect.w, aspectH: aspect.h });
  const crops = cropsForCells(slots, cells, frame.printWcm, frame.printHcm, orientation);
  return slots.map((slot, index) => ({ ...slot, crop: crops[index] }));
}

function arrangeSlots(
  slots: Slot[],
  templateId: TemplateId,
  frame: { printWcm: number; printHcm: number },
  orientation: Orientation,
  spacing: CollageSpacing,
  caption: string,
): Slot[] {
  if (slots.length < COLLAGE_MIN_PHOTOS) return slots;
  const aspect = printAspect(frame.printWcm, frame.printHcm, orientation);
  const cells = layoutCells({ templateId, count: slots.length, spacing, caption, aspectW: aspect.w, aspectH: aspect.h });
  const order = arrangeIndexes(slots, cells.map((cell) => cellCentimeters(cell, frame.printWcm, frame.printHcm, orientation)));
  const ordered = order.map((index) => ({ ...slots[index], crop: undefined }));
  const crops = cropsForCells(ordered, cells, frame.printWcm, frame.printHcm, orientation);
  return ordered.map((slot, index) => ({ ...slot, crop: crops[index] }));
}

export default function CollagePage() {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const { data } = useRepo((repo) => repo.listFrames());
  const offers = data ?? [];
  const add = useCart((state) => state.add);
  const [frameIndex, setFrameIndex] = useState(0);
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [photos, setPhotos] = useState<Slot[]>([]);
  const [sources, setSources] = useState<Record<string, PhotoSource>>({});
  const [templateId, setTemplateId] = useState<TemplateId>("lado");
  const spacing: CollageSpacing = "thin";
  const background = "white" as const;
  const rounded = false;
  const [caption, setCaption] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [ack, setAck] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const picked = useRef(false);
  const frame = offers[frameIndex] ?? offers[0];
  const contentWidth = Math.min(width, 480) - 32;
  const frameId = frame?.id;

  useEffect(() => {
    if (picked.current || !offers.length) return;
    const found = offers.findIndex((item) => item.id === "wood-15");
    setFrameIndex(found >= 0 ? found : 0);
    picked.current = true;
  }, [offers]);

  useEffect(() => {
    if (frame?.aspect === "1:1" && orientation !== "portrait") setOrientation("portrait");
  }, [frame?.aspect, orientation]);

  useEffect(() => {
    if (!frameId || photos.length < COLLAGE_MIN_PHOTOS) return;
    const resolved = resolveLayout(templateId, photos.length);
    if (resolved.id !== templateId) {
      setTemplateId(resolved.id);
      setNotice(resolved.notice);
      return;
    }
    const spec = frameById(frameId);
    setPhotos((current) => withCrops(current, resolved.id, spec, orientation, spacing, caption));
    setAck(false);
  }, [templateId, spacing, caption, orientation, frameId, photos.length]);

  const filled = photos.length >= COLLAGE_MIN_PHOTOS;
  const shownTemplate = filled ? resolveLayout(templateId, photos.length).id : templateId;
  const shownCount = filled ? photos.length : previewCount(templateId);
  const aspect = frame ? printAspect(frame.printWcm, frame.printHcm, orientation) : { w: 3, h: 4 };
  const cells = useMemo(() => {
    if (!frame) return [];
    return layoutCells({ templateId: shownTemplate, count: shownCount, spacing, caption, aspectW: aspect.w, aspectH: aspect.h });
  }, [frame, shownTemplate, shownCount, spacing, caption, aspect.w, aspect.h]);
  const assessed = frame && photos.length >= COLLAGE_MIN_PHOTOS && cells.length === photos.length ? assessCells(photos.map((photo) => photo.crop), cells, frame.printWcm, frame.printHcm, orientation) : null;
  const preview = frame ? frameWidthForBox(frame, orientation, contentWidth) : contentWidth;
  const stage = frame ? frameStage(frame, orientation, preview) : null;
  const checkStock = stockChecksEnabled();
  const soldOut = Boolean(checkStock && frame && !frame.stockUncertain && frame.available <= 0);
  async function addIncoming(incoming: { id: string; width: number; height: number }[]) {
    if (!incoming.length) return;
    if (incoming.some((photo) => isExamplePhoto(photo.id))) {
      setNote(EXAMPLE_PHOTO_PROMPT);
      return;
    }
    const { take, note: limitNote } = mergePhotoCount(photos.length, incoming.length);
    const added: Slot[] = incoming.slice(0, take).map((photo) => ({
      photoId: photo.id,
      width: photo.width,
      height: photo.height,
      crop: { imageWidth: photo.width, imageHeight: photo.height, x: 0, y: 0, width: photo.width, height: photo.height },
    }));
    if (!added.length) {
      setNote(limitNote);
      return;
    }
    const count = photos.length + added.length;
    const resolved = resolveLayout(templateId, count);
    if (resolved.id !== templateId) setTemplateId(resolved.id);
    setNotice(resolved.notice);
    setNote(limitNote);
    const spec = frame ? { printWcm: frame.printWcm, printHcm: frame.printHcm } : { printWcm: 15, printHcm: 20 };
    setPhotos(arrangeSlots([...photos, ...added], resolved.id, spec, orientation, spacing, caption));
    for (const photo of added) {
      const source = await resolvePhoto(photo.photoId);
      setSources((current) => ({ ...current, [photo.photoId]: source }));
    }
  }

  function removeAt(index: number) {
    setSelected(null);
    setPhotos((current) => current.filter((_, place) => place !== index));
  }

  async function commit() {
    if (!frame || !assessed || photos.length < COLLAGE_MIN_PHOTOS) return;
    if (photos.some((photo) => isExamplePhoto(photo.photoId))) {
      setNote(EXAMPLE_PHOTO_PROMPT);
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const snapshot = buildSnapshot({
        templateId,
        spacing,
        background,
        rounded,
        caption,
        frameId: frame.id,
        orientation,
        printWcm: frame.printWcm,
        printHcm: frame.printHcm,
        photos,
      });
      const images = await Promise.all(photos.map((photo) => loadCanvasImage(photo.photoId)));
      const blob = await renderCollageBlob(snapshot, images);
      const saved = await savePhotoBlob(blob);
      add({
        id: uid("ci_"),
        frameId: frame.id,
        photoId: saved.id,
        crop: fullFrameCrop(saved.width, saved.height),
        orientation,
        dpi: Math.round(assessed.dpi),
        resolutionStatus: assessed.status,
        collage: snapshot,
      });
      router.push("/carrito");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "No pudimos preparar la impresión.");
    } finally {
      setBusy(false);
    }
  }

  if (!frame || !stage) {
    return (
      <Screen footer={<TabBar />}>
        <Text style={{ padding: 20, fontFamily: font.body }}>Cargando marcos…</Text>
      </Screen>
    );
  }

  const slots = photos.map((photo) => ({ ...photo, source: sources[photo.photoId] }));

  return (
    <Screen
      footer={
        <View>
          <View style={{ paddingHorizontal: 16, paddingTop: 8, gap: 8, backgroundColor: colors.bg }}>
            {note ? <Text style={{ fontFamily: font.medium, color: colors.bad, textAlign: "center" }}>{note}</Text> : null}
            <Button
              label={soldOut ? "Sin stock" : busy ? "Preparando la impresión…" : "Agregar al carrito"}
              disabled={soldOut || busy || photos.length < COLLAGE_MIN_PHOTOS || (assessed?.status === "low" && !ack)}
              onPress={() => void commit()}
            />
          </View>
          <TabBar />
        </View>
      }
    >
      <View style={{ padding: 16, gap: 14 }}>
        <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink, textAlign: "center" }}>Collage de fotos</Text>
        <Text style={{ fontFamily: font.body, color: colors.muted, textAlign: "center" }}>
          Elige primero el diseño. Luego sube de 2 a 12 fotos juntas y las acomodamos. Arrastra Ordenar para cambiar el orden, toca dos fotos para intercambiarlas y arrastra la foto para encuadrarla.
        </Text>
        <Animated.View key={`${frame.id}-${shownTemplate}-${orientation}-${shownCount}`} entering={reduced ? undefined : FadeInDown.duration(360)} style={{ alignItems: "center" }}>
          <FrameView
            frame={frame}
            orientation={orientation}
            width={preview}
            opening={
              <CollageBoard
                width={stage.opening.w}
                height={stage.opening.h}
                cells={cells}
                slots={filled ? slots : []}
                background={background}
                rounded={rounded}
                caption={caption.trim()}
                festive={shownTemplate === "navidad"}
                selected={filled ? selected : null}
                onSelect={setSelected}
                onCrop={(index, crop) => setPhotos((current) => current.map((photo, place) => (place === index ? { ...photo, crop } : photo)))}
                onSwap={(from, to) => {
                  setPhotos((current) => withCrops(swapped(current, from, to), templateId, frame, orientation, spacing, caption));
                  void Haptics.selectionAsync();
                }}
              />
            }
          />
        </Animated.View>
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.displaySoft, fontSize: 24, color: colors.ink }}>{frame.name}</Text>
            <Text style={{ fontFamily: font.medium, color: colors.muted }}>{frame.tierLabel} · {frame.sizeLabel}{filled ? ` · ${photos.length} fotos` : " · vista del diseño"}</Text>
          </View>
          <PriceTicker cents={framedPriceCents(frame.priceCents, true)} />
        </View>
        <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Elige un diseño</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {TEMPLATES.map((item) => (
            <LayoutCard
              key={item.id}
              item={item}
              selected={templateId === item.id}
              onPress={() => {
                void Haptics.selectionAsync();
                if (!filled) {
                  setTemplateId(item.id);
                  setNotice(null);
                  return;
                }
                const resolved = resolveLayout(item.id, photos.length);
                setTemplateId(resolved.id);
                setNotice(resolved.notice);
              }}
            />
          ))}
        </View>
        {notice ? <Banner tone="warn" text={notice} /> : null}
        {assessed?.message ? <Banner tone={assessed.status === "low" ? "bad" : "warn"} text={assessed.message} /> : null}
        {assessed?.status === "low" ? (
          <Pressable onPress={() => setAck((value) => !value)} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ fontFamily: font.medium, color: colors.ink }}>{ack ? "☑" : "☐"} Entiendo que se verá suave y quiero seguir</Text>
          </Pressable>
        ) : null}
        <Card>
          <Text style={{ fontFamily: font.displaySoft, fontSize: 24, color: colors.ink, textAlign: "center" }}>Tus fotos</Text>
          <Text style={{ fontFamily: font.body, color: colors.muted, textAlign: "center", marginVertical: 8 }}>
            Puedes elegir hasta 12 a la vez. JPG, PNG o HEIC. Sirve en el teléfono y en la computadora.
          </Text>
          <PhotoSources multiple deviceOnly print={frame} onPhoto={(photo) => void addIncoming([photo])} onPhotos={(pickedPhotos) => void addIncoming(pickedPhotos)} />
          {photos.length === 1 ? <Text style={{ fontFamily: font.medium, color: colors.ink, textAlign: "center" }}>Falta al menos una foto más.</Text> : null}
        </Card>
        {filled ? (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {selected != null ? <Button label="Acercar" tone="ghost" onPress={() => setPhotos((current) => current.map((photo, index) => (index === selected ? { ...photo, crop: zoomCrop(photo.crop, 1.2) } : photo)))} /> : null}
              {selected != null ? <Button label="Alejar" tone="ghost" onPress={() => setPhotos((current) => current.map((photo, index) => (index === selected ? { ...photo, crop: zoomCrop(photo.crop, 1 / 1.2) } : photo)))} /> : null}
              {selected != null ? <Button label="Quitar esta foto" tone="ghost" onPress={() => removeAt(selected)} /> : null}
            </View>
            <Field label="Leyenda" placeholder="Navidad 2026 · Familia" value={caption} onChangeText={(value) => setCaption(value.slice(0, 48))} />
            {frame.aspect !== "1:1" ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Chip label="Vertical" on={orientation === "portrait"} onPress={() => setOrientation("portrait")} />
                <Chip label="Horizontal" on={orientation === "landscape"} onPress={() => setOrientation("landscape")} />
              </View>
            ) : null}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {offers.map((item, index) => (
                <Pressable key={item.id} onPress={() => setFrameIndex(index)} style={{ width: 78, alignItems: "center", opacity: item.id === frame.id ? 1 : 0.55 }}>
                  <FrameView frame={item} width={64} />
                  <Text style={{ fontFamily: font.medium, fontSize: 11, color: colors.ink, textAlign: "center" }}>{item.sizeLabel}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function LayoutCard({
  item,
  selected,
  onPress,
}: {
  item: (typeof TEMPLATES)[number];
  selected: boolean;
  onPress: () => void;
}) {
  const [focused, setFocused] = useState(false);
  const count = previewCount(item.id);
  const cells = layoutCells({ templateId: item.id, count, spacing: "thin", caption: "", aspectW: 3, aspectH: 4 });
  return (
    <Pressable
      testID={`plantilla-${item.id}`}
      accessibilityRole="button"
      accessibilityLabel={item.name}
      accessibilityState={{ selected }}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={{
        width: "47%",
        minHeight: 148,
        borderRadius: 16,
        borderWidth: selected || focused ? 3 : 1,
        borderColor: selected ? colors.red : focused ? colors.ink : colors.line,
        backgroundColor: selected ? "#FFF4F2" : colors.white,
        padding: 10,
        gap: 8,
      }}
    >
      <View style={{ height: 92, backgroundColor: "#F6EFE6", borderRadius: 10, overflow: "hidden" }}>
        {cells.map((cell, index) => (
          <View
            key={index}
            style={{
              position: "absolute",
              left: `${cell.x * 100}%`,
              top: `${cell.y * 100}%`,
              width: `${cell.w * 100}%`,
              height: `${cell.h * 100}%`,
              borderWidth: 1,
              borderColor: colors.line,
              backgroundColor: colors.white,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text style={{ fontFamily: font.semibold, fontSize: 10, color: colors.ink }}>{index + 1}</Text>
          </View>
        ))}
      </View>
      <Text style={{ fontFamily: font.semibold, color: colors.ink, textAlign: "center" }}>{item.name}</Text>
      <Text style={{ fontFamily: font.medium, fontSize: 12, color: selected ? colors.red : colors.muted, textAlign: "center" }}>{selected ? "Elegida" : item.min === item.max ? `${item.min} fotos` : "2 a 12 fotos"}</Text>
    </Pressable>
  );
}

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", backgroundColor: on ? colors.ink : colors.white, borderWidth: 1, borderColor: on ? colors.ink : colors.line }}>
      <Text style={{ fontFamily: font.semibold, color: on ? "white" : colors.ink }}>{label}</Text>
    </Pressable>
  );
}

async function loadCanvasImage(id: string): Promise<HTMLImageElement> {
  const photo = await resolvePhoto(id);
  const asset = photo?.source != null ? Image.resolveAssetSource(photo.source) : undefined;
  const uri = photo?.uri ?? asset?.uri;
  if (!uri || typeof window === "undefined") throw new Error("No encontramos una de las fotos.");
  const image = new window.Image();
  image.src = uri;
  await image.decode();
  return image;
}
