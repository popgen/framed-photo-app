import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { PanResponder, Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Cropper } from "../components/Cropper";
import { FrameView } from "../components/FrameView";
import { TextStyleEditor } from "../components/TextStyleEditor";
import { VoiceRecorder } from "../components/VoiceRecorder";
import { PriceTicker, useReducedMotion } from "../components/fx";
import { useApp, useRepo } from "../components/provider";
import { Banner, Button, Card, Progress, Screen, TabBar, WhatsAppButton } from "../components/ui";
import { colors, font } from "../components/theme";
import { readBoot } from "../lib/boot";
import { aspectParts, frameById, type FrameDef } from "../lib/catalog";
import { importFlags } from "../lib/env";
import { uid } from "../lib/ids";
import { pickAndSavePhotos, resolvePhoto, samplePhoto } from "../lib/photos";
import { assessResolution, centeredCrop, refitCrop, type Crop, type Orientation } from "../lib/print-size";
import { serializeOverlay, type TextOverlay } from "../lib/overlay";
import { useCart } from "../lib/store";
import type { VoiceNote } from "../lib/voice";
import type { FrameOffer } from "../lib/types";

export default function Crear() {
  const { width } = useWindowDimensions();
  const reduced = useReducedMotion();
  const { data } = useRepo((repo) => repo.listFrames());
  const offers = data ?? [];
  const [index, setIndex] = useState(2);
  const [orientation, setOrientation] = useState<Orientation>("portrait");
  const [photo, setPhoto] = useState<{ id: string; width: number; height: number } | null>(null);
  const [crop, setCrop] = useState<Crop | null>(null);
  const [source, setSource] = useState<{ uri?: string; source?: number } | null>(null);
  const [ack, setAck] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<TextOverlay | null>(null);
  const [voice, setVoice] = useState<VoiceNote | null>(null);
  const add = useCart((state) => state.add);
  const frame = offers[index] ?? offers[0];
  const contentWidth = Math.min(width, 480) - 32;

  const indexRef = useRef(index);
  const offersRef = useRef(offers);
  indexRef.current = index;
  offersRef.current = offers;

  useEffect(() => {
    if (!offers.length) return;
    const boot = readBoot();
    if (!boot?.photo) return;
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

  async function choosePhoto(next: { id: string; width: number; height: number }, frameOverride?: FrameDef) {
    const current = frameOverride ?? frame ?? frameById("wood-15");
    const [aw, ah] = aspectParts(current, orientation);
    setPhoto(next);
    setCrop(centeredCrop(next.width, next.height, aw, ah));
    setAck(false);
    setSource(await resolvePhoto(next.id));
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
      onPanResponderRelease: (_event, gesture) => {
        const list = offersRef.current;
        if (!list.length) return;
        const current = indexRef.current;
        const next = gesture.dx < -40 ? (current + 1) % list.length : gesture.dx > 40 ? (current - 1 + list.length) % list.length : current;
        if (next !== current) {
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
  const imports = [
    flags.instagram ? "Instagram" : null,
    flags.facebook ? "Facebook" : null,
    flags.googlePhotos ? "Google Photos" : null,
  ].filter(Boolean);

  return (
    <Screen
      footer={
        <View>
          <View style={{ paddingHorizontal: 16, paddingTop: 8, backgroundColor: colors.bg }}>
            <Button
              label={frame.available <= 0 ? "Sin stock" : "Agregar al carrito"}
              disabled={frame.available <= 0 || !photo || (assessed?.status === "low" && !ack)}
              onPress={() => {
                if (!photo || !assessed) return;
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
        <Progress step={photo ? 2 : 1} />
        <View {...pan.panHandlers}>
          <Animated.View key={`${frame.id}-${orientation}`} entering={reduced ? undefined : FadeInDown.springify().damping(16)}>
            <View style={{ alignItems: "center" }}>
              <FrameView frame={frame} photoId={photo?.id} crop={photo ? activeCrop : null} orientation={orientation} width={Math.min(260, contentWidth - 20)} overlay={overlay} onOverlayChange={setOverlay} />
            </View>
          </Animated.View>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ fontFamily: font.displaySoft, fontSize: 26, color: colors.ink }}>{frame.name}</Text>
            <Text style={{ fontFamily: font.medium, color: colors.muted }}>{frame.tierLabel} · {frame.sizeLabel}</Text>
          </View>
          <PriceTicker cents={frame.priceCents} />
        </View>
        <Text style={{ fontFamily: font.body, color: colors.muted }}>{frame.blurb} Desliza el marco como un filtro.</Text>
        {frame.available <= 5 ? <Banner tone={frame.available === 0 ? "bad" : "warn"} text={frame.available === 0 ? "Este marco se agotó." : `Quedan ${frame.available}. El dorado comparte stock con su cuerpo.`} /> : null}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
          <Pressable onPress={() => { const found = offers.findIndex((item) => item.category === "navidad"); if (found >= 0) shift(found - index); }} style={{ width: 72, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: font.semibold, color: colors.red, textAlign: "center" }}>Navidad</Text>
          </Pressable>
          {offers.map((item, itemIndex) => (
            <Pressable key={item.id} onPress={() => shift(itemIndex - index)} style={{ width: 72, alignItems: "center", opacity: itemIndex === index ? 1 : 0.55 }}>
              <FrameView frame={item} width={64} />
              <Text style={{ fontFamily: font.medium, fontSize: 11, color: colors.ink, textAlign: "center" }}>{item.name.split(" ")[0]}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {frame.aspect !== "1:1" ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Mini label="Vertical" on={orientation === "portrait"} onPress={() => turn("portrait", frame, photo, crop, setOrientation, setCrop)} />
            <Mini label="Horizontal" on={orientation === "landscape"} onPress={() => turn("landscape", frame, photo, crop, setOrientation, setCrop)} />
          </View>
        ) : null}
        {assessed?.message ? <Banner tone={assessed.status === "low" ? "bad" : "warn"} text={assessed.message} /> : null}
        {assessed?.status === "low" ? (
          <Pressable onPress={() => setAck((value) => !value)} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ fontFamily: font.medium, color: colors.ink }}>{ack ? "☑" : "☐"} Entiendo que se verá suave y quiero seguir</Text>
          </Pressable>
        ) : null}
        {photo && source && crop ? (
          <Card>
            <Text style={{ fontFamily: font.semibold, color: colors.ink, marginBottom: 8 }}>Encadra la foto</Text>
            <Cropper source={source} crop={crop} aspect={[aw, ah]} width={contentWidth - 32} onChange={setCrop} />
          </Card>
        ) : (
          <Card>
            <Text style={{ fontFamily: font.displaySoft, fontSize: 24, color: colors.ink }}>Tu foto</Text>
            <Text style={{ fontFamily: font.body, color: colors.muted, marginVertical: 8 }}>JPG, PNG o HEIC. En el iPhone abre Fotos, también las que viven en iCloud, y las pasamos a JPEG en alta.</Text>
            <Button label="Desde tu iPhone / iCloud" onPress={() => void pickOne(choosePhoto, setMessage, frame)} />
            <View style={{ height: 8 }} />
            <Button label="Usar foto de ejemplo" tone="ghost" onPress={() => void choosePhoto(samplePhoto())} />
            <View style={{ height: 8 }} />
            <Button label="Probar aviso de resolución" tone="ghost" onPress={() => void choosePhoto(samplePhoto("sample-small"))} />
          </Card>
        )}
        {photo ? <Button label="Cambiar foto" tone="ghost" onPress={() => void pickOne(choosePhoto, setMessage, frame)} /> : null}
        {imports.length ? (
          <Text style={{ fontFamily: font.medium, color: colors.muted }}>También puedes importar desde {imports.join(", ")}. Esas cuentas se configuran con las variables del README.</Text>
        ) : null}
        {photo ? (
          <Card>
            <TextStyleEditor label="Texto en la foto" value={overlay} onChange={setOverlay} maxChars={48} />
          </Card>
        ) : null}
        <Card>
          <VoiceRecorder value={voice} onChange={setVoice} />
        </Card>
        <Pressable onPress={() => router.push("/tarjeta")}>
          <Text style={{ fontFamily: font.semibold, color: colors.ink }}>¿Mejor una tarjeta navideña?</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/retablo")}>
          <Card>
            <Text style={{ fontFamily: font.displaySoft, fontSize: 22, color: colors.ink }}>¿Quieres un retablo de verdad?</Text>
            <Text style={{ fontFamily: font.body, color: colors.muted }}>Pregúntanos por nuestro retablo de verdad. Tres hojas de madera, hechas a mano. No entra al carrito.</Text>
          </Card>
        </Pressable>
        {message ? <Banner tone="bad" text={message} /> : null}
      </View>
      <WhatsAppButton />
    </Screen>
  );
}

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

async function pickOne(
  choose: (photo: { id: string; width: number; height: number }) => Promise<void>,
  setMessage: (value: string | null) => void,
  frame?: { printWcm: number; printHcm: number },
) {
  try {
    const saved = await pickAndSavePhotos(false, frame);
    if (saved[0]) await choose(saved[0]);
  } catch (error) {
    setMessage(error instanceof Error ? error.message : "No pudimos leer esa foto.");
  }
}
