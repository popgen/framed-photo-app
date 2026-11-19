import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { PanResponder, Platform, Pressable, ScrollView, Text, useWindowDimensions, View, type ViewStyle } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { ClearPhotosButton, forgetClearedDraft } from "../components/ClearPhotosButton";
import { CollagePromo } from "../components/CollagePromo";
import { Collapsible } from "../components/Collapsible";
import { Cropper } from "../components/Cropper";
import { PhotoSources, type PhotoSourcesHandle } from "../components/PhotoSources";
import { FrameView } from "../components/FrameView";
import { TextStyleEditor } from "../components/TextStyleEditor";
import { VoiceRecorder } from "../components/VoiceRecorder";
import { PriceTicker, useReducedMotion } from "../components/fx";
import { useApp, useRepo } from "../components/provider";
import { Banner, Button, Card, Progress, Screen, TabBar } from "../components/ui";
import { colors, font } from "../components/theme";
import { readBoot } from "../lib/boot";
import { clearSingleEditor, hasLoadedPhotos, planForget } from "../lib/clear-creator";
import { INITIAL_EDITOR_SECTION, editorHeaderId, revealEditorHeader, toggleEditorSection, type EditorSection } from "../lib/editor-sections";
import { aspectParts, frameById, frameChips, framesForChip, type FrameChip, type FrameDef } from "../lib/catalog";
import { importFlags, stockChecksEnabled } from "../lib/env";
import { uid } from "../lib/ids";
import { EXAMPLE_PHOTO_PROMPT, isExamplePhoto } from "../lib/example-photo";
import { resolvePhoto, samplePhoto } from "../lib/photos";
import { assessResolution, centeredCrop, refitCrop, type Crop, type Orientation } from "../lib/print-size";
import { serializeOverlay, type TextOverlay } from "../lib/overlay";
import { useCart } from "../lib/store";
import type { VoiceNote } from "../lib/voice";
import type { FrameOffer } from "../lib/types";

export default function Crear() {
  const params = useLocalSearchParams<{ import?: string }>();
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const { refresh } = useApp();
  const { data } = useRepo((repo) => repo.listFrames());
  const offers = data ?? [];
  const [index, setIndex] = useState(2);
  const [chip, setChip] = useState<FrameChip>("todos");
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [photo, setPhoto] = useState<{ id: string; width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [source, setSource] = useState<{ uri?: string; source?: number } | null>(null);
  const [ack, setAck] = useState(false);
  const [overlay, setOverlay] = useState<TextOverlay | null>(null);
  const [voice, setVoice] = useState<VoiceNote | null>(null);
  const [sampleNote, setSampleNote] = useState<string | null>(null);
  const [section, setSection] = useState<EditorSection | null>(INITIAL_EDITOR_SECTION);
  const pendingReveal = useRef<EditorSection | null>(null);
  const add = useCart((state) => state.add);
  const cartItems = useCart((state) => state.items);
  const frame = offers[index] ?? offers[0];
  const contentWidth = Math.min(width, 480) - 32;

  const indexRef = useRef(index);
  const offersRef = useRef(offers);
  const chipRef = useRef(chip);
  const sourcesRef = useRef<PhotoSourcesHandle>(null);
  const requestId = useRef(0);
  const voiceGen = useRef(0);
  const [voiceKey, setVoiceKey] = useState(0);
  const exampleRef = useRef(false);
  indexRef.current = index;
  offersRef.current = offers;
  chipRef.current = chip;
  exampleRef.current = Boolean(photo && isExamplePhoto(photo.id));
  const visible = framesForChip(offers, chip);

  useEffect(() => {
    if (!offers.length) return;
    const boot = readBoot();
    if (!boot?.photo) {
      void choosePhoto(samplePhoto());
      return;
    }
    void choosePhoto(boot.photo);
    if (boot.frameId) {
      const found = offers.findIndex((item) => item.id === boot.frameId);
      if (found >= 0) setIndex(found);
    }
  }, [offers.length]);

  useEffect(() => {
    const current = offers[index];
    if (!photo || !crop || !current) return;
    const [nextW, nextH] = aspectParts(current, orientation);
    const ratio = crop.width / crop.height;
    const target = nextW / nextH;
    if (Math.abs(ratio - target) < 0.02) return;
    setCrop(refitCrop(crop, nextW, nextH));
  }, [index, orientation]);

  function toggleSection(target: EditorSection) {
    setSection((current) => {
      const next = toggleEditorSection(current, target);
      pendingReveal.current = next;
      return next;
    });
  }

  function pickFromChip() {
    sourcesRef.current?.pickFromDevice();
  }

  useEffect(() => {
    const target = pendingReveal.current;
    if (!target) return;
    const delay = reduced ? 32 : 280;
    const handle = setTimeout(() => {
      if (pendingReveal.current !== target) return;
      pendingReveal.current = null;
      revealEditorHeader(target, reduced);
    }, delay);
    return () => clearTimeout(handle);
  }, [section, reduced]);

  async function choosePhoto(next: { id: string; width: number; height: number }, frameOverride?: FrameDef) {
    const request = ++requestId.current;
    const current = frameOverride ?? frame ?? frameById("wood-15");
    const [aw, ah] = aspectParts(current, orientation);
    setPhoto(next);
    setCrop(centeredCrop(next.width, next.height, aw, ah));
    setAck(false);
    if (!isExamplePhoto(next.id)) setSampleNote(null);
    const resolved = await resolvePhoto(next.id);
    if (request !== requestId.current) return;
    setSource(resolved);
  }

  function clearLoaded() {
    const example = samplePhoto();
    const next = clearSingleEditor(
      {
        frameId: frame?.id ?? "",
        orientation,
        chip,
        photoId: photo?.id ?? null,
        overlayText: overlay?.text ?? null,
        voiceToken: voice?.token ?? null,
        ack,
        sampleNote,
      },
      example.id,
    );
    const plan = planForget({
      photoIds: [photo?.id],
      extraIds: [voice?.audioId, voice?.selfieId],
      voiceToken: voice?.token,
      cart: cartItems,
    });
    voiceGen.current += 1;
    setVoiceKey((value) => value + 1);
    setOverlay(null);
    setVoice(null);
    setAck(next.ack);
    setSampleNote(next.sampleNote);
    setSource(null);
    void choosePhoto(example);
    if (plan) void forgetClearedDraft(plan);
  }

  function shift(delta: number) {
    if (!offers.length) return;
    const next = (index + delta + offers.length) % offers.length;
    setIndex(next);
    void Haptics.selectionAsync();
    if (photo && crop) {
      const [aw, ah] = aspectParts(offers[next], orientation);
      setCrop(refitCrop(crop, aw, ah));
    }
  }

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_event, gesture) => Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onMoveShouldSetPanResponderCapture: (_event, gesture) => exampleRef.current && Math.abs(gesture.dx) > 18 && Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderRelease: (_event, gesture) => {
        const list = framesForChip(offersRef.current, chipRef.current);
        if (!list.length) return;
        const currentId = offersRef.current[indexRef.current]?.id;
        const place = Math.max(0, list.findIndex((item) => item.id === currentId));
        const nextItem = gesture.dx < -40 ? list[(place + 1) % list.length] : gesture.dx > 40 ? list[(place - 1 + list.length) % list.length] : null;
        const next = nextItem ? offersRef.current.findIndex((item) => item.id === nextItem.id) : indexRef.current;
        if (next !== indexRef.current && next >= 0) {
          setIndex(next);
          void Haptics.selectionAsync();
        }
      },
    }),
  ).current;

  if (!frame) {
    return (
      <Screen footer={<TabBar />}>
        <Text style={{ padding: 20, fontFamily: font.body }}>Cargando marcos…</Text>
      </Screen>
    );
  }

  const [aw, ah] = aspectParts(frame, orientation);
  const activeCrop = crop ?? centeredCrop(photo?.width ?? 1200, photo?.height ?? 1600, aw, ah);
  const assessed = photo
    ? assessResolution({
        cropWidthPx: activeCrop.width,
        cropHeightPx: activeCrop.height,
        printWcm: frame.printWcm,
        printHcm: frame.printHcm,
        orientation,
        alternatives: offers.map((item) => ({ id: item.id, label: item.sizeLabel, printWcm: item.printWcm, printHcm: item.printHcm })),
      })
    : null;
  const flags = importFlags();
  const checkStock = stockChecksEnabled();
  const soldOut = checkStock && !frame.stockUncertain && frame.available <= 0;
  const showingExample = Boolean(photo && isExamplePhoto(photo.id));
  const preview = (
    <FrameView frame={frame} photoId={photo?.id} crop={photo ? activeCrop : null} orientation={orientation} width={Math.min(260, contentWidth - 20)} overlay={overlay} onOverlayChange={setOverlay} animateSample />
  );

  return (
    <Screen
      footer={
        <View>
          <View style={{ paddingHorizontal: 16, paddingTop: 8, backgroundColor: colors.bg }}>
            {sampleNote ? <Text style={{ fontFamily: font.medium, color: colors.bad, textAlign: "center" }}>{sampleNote}</Text> : null}
            <Button
              label={soldOut ? "Sin stock" : "Agregar al carrito"}
              disabled={soldOut || !photo || (assessed?.status === "low" && !ack)}
              onPress={() => {
                if (!photo || !assessed) return;
                if (isExamplePhoto(photo.id)) {
                  setSampleNote(EXAMPLE_PHOTO_PROMPT);
                  return;
                }
                add({
                  id: uid("ci_"),
                  frameId: frame.id,
                  photoId: photo.id,
                  crop: activeCrop,
                  orientation,
                  dpi: Math.round(assessed.dpi),
                  resolutionStatus: assessed.status,
                  textOverlay: serializeOverlay(overlay),
                  voice,
                });
                router.push("/carrito");
              }}
            />
          </View>
          <TabBar />
        </View>
      }
    >
      <View style={{ padding: 16, gap: 14 }}>
        <Progress step={photo && !isExamplePhoto(photo.id) ? 2 : 1} />
        <View {...pan.panHandlers}>
          <Animated.View key={`${frame.id}-${orientation}`} entering={reduced ? undefined : FadeInDown.springify().damping(16)}>
            <View style={{ alignItems: "center", position: "relative" }}>
              {showingExample ? (
                <Pressable
                  accessible={false}
                  onPress={pickFromChip}
                  style={webPointer}
                >
                  {preview}
                </Pressable>
              ) : preview}
              {showingExample ? (
                <View pointerEvents="box-none" style={uploadSlot}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Sube tu foto desde tu dispositivo"
                    onPress={pickFromChip}
                    style={({ pressed }) => [uploadChip, webPointer, pressed && { transform: [{ scale: 0.97 }] }]}
                  >
                    <Text accessibilityElementsHidden importantForAccessibility="no" style={{ color: "#F6E2A8", fontSize: 16, lineHeight: 18 }}>★</Text>
                    <Text style={{ fontFamily: font.bold, color: "white", fontSize: 16 }}>Sube tu foto</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </Animated.View>
        </View>
        {hasLoadedPhotos([photo?.id]) ? <ClearPhotosButton onConfirm={clearLoaded} /> : null}
        <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ fontFamily: font.displaySoft, fontSize: 24, lineHeight: 28, color: colors.ink }}>{frame.name}</Text>
            <Text style={{ fontFamily: font.medium, color: colors.muted }}>{frame.tierLabel} · {frame.sizeLabel}</Text>
          </View>
          <View style={{ flexShrink: 0 }}>
            <PriceTicker cents={frame.priceCents} />
          </View>
        </View>
        <Text style={{ fontFamily: font.body, color: colors.muted }}>Desliza el marco como un filtro.</Text>
        {checkStock && frame.stockUncertain ? (
          <View style={{ gap: 8 }}>
            <Banner tone="warn" text="No pudimos leer el stock. Puedes seguir; lo confirmamos al pagar." />
            <Pressable onPress={refresh} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Reintentar</Text>
            </Pressable>
          </View>
        ) : frame.available <= 0 ? (
          <Banner tone="bad" text="Este marco se agotó." />
        ) : frame.lowStock ? (
          <Banner tone="warn" text="Pocas unidades" />
        ) : null}
        <CollagePromo />
        <Collapsible title="Elige tu marco" headerId={editorHeaderId("frame")} open={section === "frame"} onToggle={() => toggleSection("frame")}>
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
              {frameChips(offers).map((item) => (
                <Pressable
                  key={item.id}
                  onPress={() => {
                    setChip(item.id);
                    const first = framesForChip(offers, item.id)[0];
                    if (!first) return;
                    const found = offers.findIndex((frameItem) => frameItem.id === first.id);
                    if (found >= 0) shift(found - index);
                  }}
                  style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", backgroundColor: chip === item.id ? colors.ink : colors.white, borderWidth: 1, borderColor: chip === item.id ? colors.ink : colors.line }}
                >
                  <Text style={{ fontFamily: font.semibold, color: chip === item.id ? "white" : colors.ink }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
              {visible.map((item) => (
                <Pressable key={item.id} onPress={() => { const found = offers.findIndex((frameItem) => frameItem.id === item.id); if (found >= 0) shift(found - index); }} style={{ width: 96, alignItems: "center", opacity: item.id === frame.id ? 1 : 0.55 }}>
                  <FrameView frame={item} width={64} />
                  <Text numberOfLines={2} style={{ fontFamily: font.medium, fontSize: 11, color: colors.ink, textAlign: "center" }}>{item.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {frame.aspect !== "1:1" ? (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <Mini label="Vertical" on={orientation === "portrait"} onPress={() => turn("portrait", frame, photo, crop, setOrientation, setCrop)} />
                <Mini label="Horizontal" on={orientation === "landscape"} onPress={() => turn("landscape", frame, photo, crop, setOrientation, setCrop)} />
              </View>
            ) : null}
          </View>
        </Collapsible>
        {assessed?.message ? <Banner tone={assessed.status === "low" ? "bad" : "warn"} text={assessed.message} /> : null}
        {assessed?.status === "low" ? (
          <Pressable onPress={() => setAck((value) => !value)} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ fontFamily: font.medium, color: colors.ink }}>{ack ? "☑" : "☐"} Entiendo que se verá suave y quiero seguir</Text>
          </Pressable>
        ) : null}
        <Collapsible title="Encuadra la foto" headerId={editorHeaderId("photo")} open={section === "photo"} onToggle={() => toggleSection("photo")} keepMounted>
          <View style={{ gap: 16 }}>
            {photo && source && crop ? (
              <Cropper source={source} crop={crop} aspect={[aw, ah]} width={contentWidth - 32} onChange={setCrop} />
            ) : (
              <>
                <Text style={{ fontFamily: font.displaySoft, fontSize: 24, color: colors.ink }}>Tu foto</Text>
                <Text style={{ fontFamily: font.body, color: colors.muted }}>JPG, PNG o HEIC. La galería del teléfono es la primera opción. En el iPhone también puedes abrir iCloud, y el HEIC pasa a JPEG.</Text>
              </>
            )}
            <PhotoSources ref={sourcesRef} print={frame} flags={flags} notice={params.import} onPhoto={(next) => choosePhoto(next, frame)} />
            <View style={{ borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 16 }}>
              <Button label="Probar aviso de resolución" tone="quiet" onPress={() => void choosePhoto(samplePhoto("sample-small"))} />
            </View>
          </View>
        </Collapsible>
        {photo ? (
          <TextStyleEditor
            collapsible
            label="Agrega texto a tu foto"
            value={overlay}
            onChange={setOverlay}
            maxChars={48}
            open={section === "text"}
            onToggle={() => toggleSection("text")}
            headerId={editorHeaderId("text")}
          />
        ) : null}
        <VoiceRecorder
          key={voiceKey}
          value={voice}
          onChange={(next) => {
            if (voiceGen.current !== voiceKey) return;
            setVoice(next);
          }}
          open={section === "voice"}
          onToggle={() => toggleSection("voice")}
          headerId={editorHeaderId("voice")}
        />
        <Pressable onPress={() => router.push("/tarjeta")}>
          <Text style={{ fontFamily: font.semibold, color: colors.ink }}>¿Mejor una tarjeta navideña?</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/retablo")}>
          <Card>
            <Text style={{ fontFamily: font.displaySoft, fontSize: 22, color: colors.ink }}>¿Quieres un retablo de verdad?</Text>
            <Text style={{ fontFamily: font.body, color: colors.muted }}>Pregúntanos por nuestro retablo de verdad. Tres hojas de madera, hechas a mano. No entra al carrito.</Text>
          </Card>
        </Pressable>
      </View>
    </Screen>
  );
}

const webPointer = (Platform.OS === "web" ? { cursor: "pointer" } : null) as ViewStyle;

const uploadSlot: ViewStyle = {
  position: "absolute",
  left: 0,
  right: 0,
  bottom: 26,
  zIndex: 3,
  alignItems: "center",
};

const uploadChip: ViewStyle = {
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
  minHeight: 44,
  paddingHorizontal: 16,
  borderRadius: 999,
  backgroundColor: colors.red,
  borderWidth: 2,
  borderColor: "#F0D48A",
  shadowColor: "#241714",
  shadowOpacity: 0.28,
  shadowRadius: 10,
  shadowOffset: { width: 0, height: 5 },
};

function Mini({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ minHeight: 44, paddingHorizontal: 14, borderRadius: 999, justifyContent: "center", backgroundColor: on ? colors.ink : colors.white, borderWidth: 1, borderColor: colors.line }}>
      <Text style={{ fontFamily: font.semibold, color: on ? "white" : colors.ink }}>{label}</Text>
    </Pressable>
  );
}

function turn(
  next: Orientation,
  frame: FrameOffer,
  photo: { width: number; height: number } | null,
  crop: Crop | null,
  setOrientation: (value: Orientation) => void,
  setCrop: (value: Crop) => void,
) {
  setOrientation(next);
  if (!photo || !crop) return;
  const [aw, ah] = aspectParts(frame, next);
  setCrop(refitCrop(crop, aw, ah));
}
