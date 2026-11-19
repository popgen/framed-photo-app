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
  POLAROID_PREVIEW_SEED,
  TEMPLATES,
  assessCells,
  buildSnapshot,
  cropsForCells,
  framedPriceCents,
  freshLayoutSeed,
  fullFrameCrop,
  mulberry32,
  polaroidCard,
  arrangeIndexes,
  cellCentimeters,
  layoutCells,
  mergePhotoCount,
  previewCount,
  printAspect,
  resolveLayout,
  shuffleSeed,
  shuffled,
  swapped,
  templateFits,
  zoomCrop,
  type CollageBackground,
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
  seed?: number,
): Slot[] {
  if (!templateFits(templateId, slots.length)) return slots;
  const aspect = printAspect(frame.printWcm, frame.printHcm, orientation);
  const cells = layoutCells({ templateId, count: slots.length, spacing, caption, aspectW: aspect.w, aspectH: aspect.h, seed });
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
  seed?: number,
): Slot[] {
  if (!templateFits(templateId, slots.length)) return slots;
  const aspect = printAspect(frame.printWcm, frame.printHcm, orientation);
  const cells = layoutCells({ templateId, count: slots.length, spacing, caption, aspectW: aspect.w, aspectH: aspect.h, seed });
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
  const [layoutSeed, setLayoutSeed] = useState(freshLayoutSeed);
  const spacing: CollageSpacing = "thin";
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
    if (!frameId || photos.length < 1) return;
    const resolved = resolveLayout(templateId, photos.length);
    if (resolved.id !== templateId) {
      setTemplateId(resolved.id);
      setNotice(resolved.notice);
      return;
    }
    if (!templateFits(resolved.id, photos.length)) return;
    const spec = frameById(frameId);
    setPhotos((current) => withCrops(current, resolved.id, spec, orientation, spacing, caption, layoutSeed));
    setAck(false);
  }, [templateId, spacing, caption, orientation, frameId, photos.length, layoutSeed]);

  const shownTemplate = photos.length >= 1 ? resolveLayout(templateId, photos.length).id : templateId;
  const filled = templateFits(shownTemplate, photos.length);
  const shownCount = filled ? photos.length : previewCount(shownTemplate);
  const viewSeed = filled && shownTemplate === "polaroids" ? layoutSeed : POLAROID_PREVIEW_SEED;
  const background: CollageBackground = shownTemplate === "polaroids" ? "desk" : "white";
  const aspect = frame ? printAspect(frame.printWcm, frame.printHcm, orientation) : { w: 3, h: 4 };
  const cells = useMemo(() => {
    if (!frame || !templateFits(shownTemplate, shownCount)) return [];
    return layoutCells({ templateId: shownTemplate, count: shownCount, spacing, caption, aspectW: aspect.w, aspectH: aspect.h, seed: viewSeed });
  }, [frame, shownTemplate, shownCount, spacing, caption, aspect.w, aspect.h, viewSeed]);
  const assessed = frame && filled && cells.length === photos.length ? assessCells(photos.map((photo) => photo.crop), cells, frame.printWcm, frame.printHcm, orientation) : null;
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
    setPhotos(arrangeSlots([...photos, ...added], resolved.id, spec, orientation, spacing, caption, layoutSeed));
    for (const photo of added) {
      const source = await resolvePhoto(photo.photoId);
      setSources((current) => ({ ...current, [photo.photoId]: source }));
    }
  }

  function removeAt(index: number) {
    setSelected(null);
    setPhotos((current) => current.filter((_, place) => place !== index));
  }

  function mixPolaroids() {
    if (!frame || !templateFits("polaroids", photos.length)) return;
    let next = freshLayoutSeed();
    if (next === layoutSeed) next = (layoutSeed + 0x9e3779b9) >>> 0 || 1;
    setLayoutSeed(next);
    setPhotos((current) =>
      withCrops(shuffled(current, mulberry32(shuffleSeed(next))), "polaroids", frame, orientation, spacing, caption, next),
    );
  }

  async function commit() {
    const resolved = resolveLayout(templateId, photos.length);
    if (!frame || !assessed || !templateFits(resolved.id, photos.length)) return;
    if (photos.some((photo) => isExamplePhoto(photo.photoId))) {
      setNote(EXAMPLE_PHOTO_PROMPT);
      return;
    }
    setBusy(true);
    setNote(null);
    try {
      const snapshot = buildSnapshot({
        templateId: resolved.id,
        spacing,
        background,
        rounded,
        caption,
        frameId: frame.id,
        orientation,
        printWcm: frame.printWcm,
        printHcm: frame.printHcm,
        photos,
        layoutSeed,
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
              disabled={soldOut || busy || !filled || (assessed?.status === "low" && !ack)}
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
          Elige primero el diseño. Luego sube las fotos juntas y las acomodamos: de 2 a 12, o una sola en Polaroids. Arrastra Ordenar para cambiar el orden, toca dos fotos para intercambiarlas y arrastra la foto para encuadrarla.
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
                polaroid={shownTemplate === "polaroids"}
                selected={filled ? selected : null}
                onSelect={setSelected}
                onCrop={(index, crop) => setPhotos((current) => current.map((photo, place) => (place === index ? { ...photo, crop } : photo)))}
                onSwap={(from, to) => {
                  setPhotos((current) => withCrops(swapped(current, from, to), templateId, frame, orientation, spacing, caption, layoutSeed));
                  void Haptics.selectionAsync();
                }}
              />
            }
          />
        </Animated.View>
        {shownTemplate === "polaroids" && photos.length >= 1 ? (
          <View style={{ gap: 6 }}>
            <Button label="Mezclar" tone="ghost" surface="white" onPress={mixPolaroids} />
            <Text style={{ fontFamily: font.body, color: colors.muted, textAlign: "center" }}>
              Cada toque reparte las fotos de nuevo: otro orden, otro lugar, otra inclinación y otro cruce. La impresión queda igual que esta vista.
            </Text>
          </View>
        ) : null}
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
          {photos.length === 1 && !templateFits(templateId, 1) ? <Text style={{ fontFamily: font.medium, color: colors.ink, textAlign: "center" }}>Falta al menos una foto más.</Text> : null}
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
  const polaroid = item.id === "polaroids";
  const cells = layoutCells({ templateId: item.id, count, spacing: "thin", caption: "", aspectW: 3, aspectH: 4, seed: POLAROID_PREVIEW_SEED });
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
      <View style={{ height: 92, backgroundColor: polaroid ? "#E4D2C0" : "#F6EFE6", borderRadius: 10, overflow: "hidden" }}>
        {cells.map((cell, index) => {
          const box = polaroid ? polaroidCard(cell, 3, 4) : cell;
          const photoLeft = polaroid ? `${((cell.x - box.x) / box.w) * 100}%` : 0;
          const photoTop = polaroid ? `${((cell.y - box.y) / box.h) * 100}%` : 0;
          const photoW = polaroid ? `${(cell.w / box.w) * 100}%` : "100%";
          const photoH = polaroid ? `${(cell.h / box.h) * 100}%` : "100%";
          return (
            <View
              key={index}
              style={{
                position: "absolute",
                left: `${box.x * 100}%`,
                top: `${box.y * 100}%`,
                width: `${box.w * 100}%`,
                height: `${box.h * 100}%`,
                borderWidth: polaroid ? 0 : 1,
                borderColor: colors.line,
                backgroundColor: polaroid ? "#FFFEFB" : colors.white,
                alignItems: "center",
                justifyContent: "center",
                transform: polaroid ? [{ rotate: `${cell.rotation ?? 0}deg` }] : undefined,
              }}
            >
              <View
                style={{
                  position: "absolute",
                  left: photoLeft,
                  top: photoTop,
                  width: photoW,
                  height: photoH,
                  backgroundColor: polaroid ? "#E7D9CC" : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Text style={{ fontFamily: font.semibold, fontSize: 10, color: colors.ink }}>{index + 1}</Text>
              </View>
            </View>
          );
        })}
      </View>
      <Text style={{ fontFamily: font.semibold, color: colors.ink, textAlign: "center" }}>{item.name}</Text>
      <Text style={{ fontFamily: font.medium, fontSize: 12, color: selected ? colors.red : colors.muted, textAlign: "center" }}>{selected ? "Elegida" : item.min === item.max ? `${item.min} fotos` : `${item.min} a ${item.max} fotos`}</Text>
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
