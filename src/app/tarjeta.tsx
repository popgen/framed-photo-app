import { Image } from "expo-image";
import { SampleScene } from "../components/SampleScene";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Cropper } from "../components/Cropper";
import { PhotoSources } from "../components/PhotoSources";
import { TextStyleEditor } from "../components/TextStyleEditor";
import { useReducedMotion } from "../components/fx";
import { Button, Card, Screen, TabBar } from "../components/ui";
import { colors, font } from "../components/theme";
import { layoutCardText, CARD_TEXT_MIN_PX } from "../lib/card-text";
import { A5_PANEL_RATIO, foldPreview } from "../lib/card-preview";
import { cardGreetings, cardSheetCopy, cardSizes, cardTemplates, DEFAULT_ENVELOPE, defaultCardSize, messageLimits, offeredCardSizes, priceCards, type CardSnapshot } from "../lib/cards";
import { importFlags } from "../lib/env";
import { formatSoles } from "../lib/money";
import { uid } from "../lib/ids";
import { EXAMPLE_PHOTO_PROMPT, isExamplePhoto } from "../lib/example-photo";
import { resolvePhoto, samplePhoto } from "../lib/photos";
import { centeredCrop, type Crop } from "../lib/print-size";
import { useCart } from "../lib/store";
import { fontById, type TextOverlay } from "../lib/overlay";

const PANELS = ["Portada", "Interior"] as const;
type PanelName = (typeof PANELS)[number];
type PanelPhoto = {
  id: string;
  width: number;
  height: number;
  crop: Crop;
  source: { uri?: string; source?: number } | null;
};

export default function Tarjeta() {
  const reduced = useReducedMotion();
  const params = useLocalSearchParams<{ import?: string }>();
  const add = useCart((state) => state.add);
  const [sizeId, setSizeId] = useState(defaultCardSize().id);
  const [templateId, setTemplateId] = useState(cardTemplates[0].id);
  const [qty, setQty] = useState(1);
  const [panel, setPanel] = useState<PanelName>("Portada");
  const [open, setOpen] = useState(false);
  const [bleed, setBleed] = useState(false);
  const [frontMessage, setFrontMessage] = useState<TextOverlay | null>(null);
  const [insideMessage, setInsideMessage] = useState<TextOverlay | null>(null);
  const [frontPhoto, setFrontPhoto] = useState<PanelPhoto | null>(null);
  const [insidePhoto, setInsidePhoto] = useState<PanelPhoto | null>(null);
  const [sampleNote, setSampleNote] = useState<string | null>(null);
  const size = cardSizes.find((item) => item.id === sizeId) ?? defaultCardSize();
  const template = cardTemplates.find((item) => item.id === templateId) ?? cardTemplates[0];
  const limits = messageLimits(size);
  const priced = priceCards(qty);

  useEffect(() => {
    void place("Portada", samplePhoto());
  }, []);

  async function place(which: PanelName, photo: { id: string; width: number; height: number }) {
    const crop = centeredCrop(photo.width, photo.height, size.panelWmm, size.panelHmm);
    const source = await resolvePhoto(photo.id);
    const next = { ...photo, crop, source };
    if (which === "Portada") setFrontPhoto(next);
    else setInsidePhoto(next);
    if (!isExamplePhoto(photo.id)) setSampleNote(null);
  }

  function save() {
    if (!frontPhoto || isExamplePhoto(frontPhoto.id)) {
      setSampleNote(EXAMPLE_PHOTO_PROMPT);
      return;
    }
    const card: CardSnapshot = {
      sizeId: size.id,
      quantity: qty,
      envelopeColor: DEFAULT_ENVELOPE,
      templateId: template.id,
      frontMessage,
      insideMessage,
      photos: {
        front: frontPhoto?.id ?? null,
        insideCenter: insidePhoto?.id ?? null,
      },
      frontCrop: frontPhoto?.crop ?? null,
      insideCrop: insidePhoto?.crop ?? null,
      layout: "half-fold",
      bleed,
    };
    add({
      id: uid("ci_"),
      frameId: `card-${size.id}`,
      photoId: "",
      crop: { imageWidth: 1, imageHeight: 1, x: 0, y: 0, width: 1, height: 1 },
      orientation: "portrait",
      dpi: 300,
      resolutionStatus: "good",
      card,
    });
    router.push("/carrito");
  }

  return (
    <Screen
      footer={
        <View nativeID="card-footer">
          <View style={{ padding: 16, gap: 8, backgroundColor: colors.bg }}>
            {sampleNote ? <Text style={{ fontFamily: font.medium, color: colors.bad, textAlign: "center" }}>{sampleNote}</Text> : null}
            <Button label={`Agregar · ${formatSoles(priced.cents)}`} onPress={save} />
          </View>
          <TabBar />
        </View>
      }
    >
      <View style={{ padding: 16, gap: 14 }}>
        <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Tarjeta navideña</Text>
        <Text style={{ fontFamily: font.body, color: colors.muted }}>Una hoja horizontal doblada a la mitad. La portada lleva la foto y adentro va el mensaje.</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {offeredCardSizes().map((item) => (
            <Pressable key={item.id} onPress={() => setSizeId(item.id)} style={chip(item.id === size.id)}>
              <Text style={chipText(item.id === size.id)}>{item.name}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ fontFamily: font.body, color: size.printShop ? colors.bad : colors.muted }}>{cardSheetCopy(size)}</Text>
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          {cardTemplates.map((item) => (
            <Pressable key={item.id} onPress={() => setTemplateId(item.id)} style={chip(item.id === template.id)}>
              <Text style={chipText(item.id === template.id)}>{item.name}</Text>
            </Pressable>
          ))}
        </View>
        <Diptych
          open={open}
          reduced={reduced}
          outside={template.outside}
          inside={template.inside}
          frontPhoto={frontPhoto}
          insidePhoto={insidePhoto}
          frontMessage={frontMessage}
          insideMessage={insideMessage}
          example={isExamplePhoto(frontPhoto?.id)}
          onPress={() => setOpen((value) => !value)}
        />
        <View style={{ flexDirection: "row", gap: 8 }}>
          {PANELS.map((item) => (
            <Pressable
              key={item}
              onPress={() => {
                setPanel(item);
                setOpen(item === "Interior");
              }}
              style={chip(panel === item)}
            >
              <Text style={chipText(panel === item)}>{item}</Text>
            </Pressable>
          ))}
        </View>
        {panel === "Portada" ? (
          <Card>
            <Text style={{ fontFamily: font.semibold, color: colors.ink, marginBottom: 8 }}>Portada</Text>
            {frontPhoto ? (
              <>
                <Text style={{ fontFamily: font.semibold, color: colors.ink, marginBottom: 8 }}>Encuadra la foto</Text>
                <Cropper
                  source={frontPhoto.source ?? {}}
                  crop={frontPhoto.crop}
                  aspect={[size.panelWmm, size.panelHmm]}
                  width={300}
                  onChange={(crop) => setFrontPhoto((current) => (current ? { ...current, crop } : current))}
                />
                <View style={{ height: 8 }} />
              </>
            ) : (
              <Text style={{ fontFamily: font.body, color: colors.muted, marginBottom: 8 }}>Una sola foto en la portada. JPG, PNG o HEIC.</Text>
            )}
            <PhotoSources
              print={{ printWcm: size.panelWmm / 10, printHcm: size.panelHmm / 10 }}
              flags={importFlags()}
              notice={params.import}
              onPhoto={(photo) => place("Portada", photo)}
            />
          </Card>
        ) : (
          <Text style={{ fontFamily: font.body, color: colors.muted }}>El mensaje va en la mitad de adentro. Puedes usar hasta 300 caracteres.</Text>
        )}
        <TextStyleEditor
          collapsible
          multiline
          label="Agrega texto a tu foto"
          placeholder={panel === "Interior" ? "El mensaje de adentro" : "El mensaje de la portada"}
          value={panel === "Interior" ? insideMessage : frontMessage}
          onChange={panel === "Interior" ? setInsideMessage : setFrontMessage}
          maxChars={panel === "Interior" ? limits.inside : limits.front}
          presets={cardGreetings}
        />
        <Text style={{ fontFamily: font.body, color: colors.muted }}>El reverso lleva la marca Mi Fotito.</Text>
        <Text style={{ fontFamily: font.body, color: colors.ink }}>Incluye sobre blanco C5</Text>
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Pressable onPress={() => setQty((value) => Math.max(1, value - 1))} style={chip(false)}><Text style={chipText(false)}>−</Text></Pressable>
          <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{priced.label}</Text>
          <Pressable onPress={() => setQty((value) => value + 1)} style={chip(false)}><Text style={chipText(false)}>+</Text></Pressable>
        </View>
        <Pressable onPress={() => setBleed((value) => !value)} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ fontFamily: font.medium, color: colors.ink }}>{bleed ? "☑" : "☐"} Sangrado de 3 mm y marcas de corte</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function Diptych({
  open,
  reduced,
  outside,
  inside,
  frontPhoto,
  insidePhoto: _insidePhoto,
  frontMessage,
  insideMessage,
  example,
  onPress,
}: {
  open: boolean;
  reduced: boolean;
  outside: string;
  inside: string;
  frontPhoto: PanelPhoto | null;
  insidePhoto: PanelPhoto | null;
  frontMessage: TextOverlay | null;
  insideMessage: TextOverlay | null;
  example: boolean;
  onPress: () => void;
}) {
  const panelW = 168;
  const panelH = Math.round(panelW * A5_PANEL_RATIO);
  const motion = foldPreview(open, reduced);
  const ease = "cubic-bezier(0.45, 0.05, 0.2, 1)";
  const stage = useRef<HTMLElement | null>(null);
  const armed = useRef(false);
  if (open) armed.current = true;
  useEffect(() => {
    if (Platform.OS !== "web" || !open) return;
    const node = stage.current;
    if (!node) return;
    const timer = window.setTimeout(() => {
      const rect = node.getBoundingClientRect();
      const footer = document.getElementById("card-footer");
      const footerHeight = footer ? footer.getBoundingClientRect().height : 170;
      const overflow = rect.bottom - (window.innerHeight - footerHeight) + 12;
      if (overflow <= 0) return;
      let parent: HTMLElement | null = node.parentElement;
      while (parent) {
        const style = getComputedStyle(parent);
        if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight + 1) {
          parent.scrollBy({ top: overflow, behavior: reduced ? "auto" : "smooth" });
          return;
        }
        parent = parent.parentElement;
      }
      window.scrollBy({ top: overflow, behavior: reduced ? "auto" : "smooth" });
    }, motion.durationMs + 40);
    return () => window.clearTimeout(timer);
  }, [open, reduced, motion.durationMs]);
  return (
    <View ref={stage as never} style={{ alignItems: "center" }}>
      {example ? <View style={{ marginBottom: 8 }}><ExampleTag /></View> : null}
      <View
        style={webStyle({
          width: panelW,
          height: Math.round(panelH * motion.liftPxRatio),
          transitionProperty: "height",
          transitionDuration: `${motion.durationMs}ms`,
          transitionTimingFunction: ease,
        })}
      >
        {reduced && open ? <PaperBack width={panelW} height={panelH} color={inside} half="top" /> : null}
      </View>
      <Pressable onPress={onPress} accessibilityLabel={motion.hint}>
        <View
          style={webStyle({
            width: panelW,
            height: panelH,
            perspective: motion.perspective,
            transformStyle: "preserve-3d",
          })}
        >
          <View style={webStyle({ position: "absolute", top: 0, left: 0, width: panelW, height: panelH, opacity: motion.insideOpacity, transitionProperty: "opacity", transitionDuration: `${motion.durationMs}ms` })}>
            <PanelFace width={panelW} height={panelH} color={inside} photo={null} overlay={insideMessage} onLight half={open ? "bottom" : null} />
          </View>
          <View
            style={webStyle({
              position: "absolute",
              top: 0,
              left: 0,
              width: panelW,
              height: panelH,
              zIndex: 2,
              opacity: motion.frontOpacity,
              transformStyle: "preserve-3d",
              transformOrigin: motion.origin,
              transform: `rotateX(${motion.rotateX})`,
              transitionProperty: reduced ? "opacity" : "transform",
              transitionDuration: `${motion.durationMs}ms`,
              transitionTimingFunction: ease,
            })}
          >
            <View
              nativeID="cover-photo"
              style={webStyle({
                position: "absolute",
                top: 0,
                left: 0,
                width: panelW,
                height: panelH,
                ...coverFaceStyle("photo", reduced, open, armed.current, motion.durationMs),
              })}
            >
              <PanelFace width={panelW} height={panelH} color={outside} photo={frontPhoto} overlay={frontMessage} />
            </View>
            <View
              nativeID="cover-paper"
              style={webStyle({
                position: "absolute",
                top: 0,
                left: 0,
                width: panelW,
                height: panelH,
                transform: "rotateX(180deg)",
                backgroundColor: inside,
                ...coverFaceStyle("paper", reduced, open, armed.current, motion.durationMs),
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: "rgba(42,27,22,0.2)",
                ...foldEdge("top"),
              })}
            >
              <Text style={{ fontFamily: font.display, fontSize: 22, color: colors.red }}>Mi Fotito</Text>
            </View>
          </View>
          <View
            pointerEvents="none"
            style={webStyle({
              position: "absolute",
              top: 0,
              left: 0,
              width: panelW,
              height: 2,
              zIndex: 3,
              opacity: open ? 1 : 0,
              background: "linear-gradient(to bottom, rgba(42,27,22,0.22), rgba(255,255,255,0.35))",
              transitionProperty: "opacity",
              transitionDuration: `${motion.durationMs}ms`,
            })}
          />
        </View>
      </Pressable>
      <Text style={{ fontFamily: font.medium, color: colors.muted, marginTop: 8 }}>{motion.hint}</Text>
    </View>
  );
}

/**
 * Corner and border treatment for one half of the opened sheet.
 * "top" is the half above the crease, "bottom" the half below it; the edge that
 * meets the fold loses its radius and its border so the halves join seamlessly.
 */
function foldEdge(half: "top" | "bottom" | null) {
  if (half === "top") {
    return { borderTopLeftRadius: 10, borderTopRightRadius: 10, borderBottomLeftRadius: 0, borderBottomRightRadius: 0, borderBottomWidth: 0 };
  }
  if (half === "bottom") {
    return { borderTopLeftRadius: 0, borderTopRightRadius: 0, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, borderTopWidth: 0 };
  }
  return { borderRadius: 10 };
}

function PaperBack({ width, height, color, half = null }: { width: number; height: number; color: string; half?: "top" | "bottom" | null }) {
  return (
    <View style={{ width, height, backgroundColor: color, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(42,27,22,0.2)", ...foldEdge(half) }}>
      <Text style={{ fontFamily: font.display, fontSize: 22, color: colors.red }}>Mi Fotito</Text>
    </View>
  );
}

function ExampleTag() {
  return (
    <View style={{ backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <Text style={{ fontFamily: font.semibold, color: "white", fontSize: 12 }}>Foto de ejemplo</Text>
    </View>
  );
}

const COVER_PHOTO_FRAMES = `
@keyframes mifotito-cover-photo {
  0%, 36.1% { opacity: 1; visibility: visible; }
  36.2%, 100% { opacity: 0; visibility: hidden; }
}
@keyframes mifotito-cover-paper {
  0%, 36.1% { opacity: 0; visibility: hidden; }
  36.2%, 100% { opacity: 1; visibility: visible; }
}
`;

function coverFaceStyle(which: "photo" | "paper", reduced: boolean, open: boolean, armed: boolean, durationMs: number) {
  if (reduced || !armed || typeof document === "undefined") {
    return which === "photo" ? { opacity: 1, visibility: "visible" } : { opacity: 0, visibility: "hidden" };
  }
  if (!document.getElementById("mifotito-cover-photo")) {
    const sheet = document.createElement("style");
    sheet.id = "mifotito-cover-photo";
    sheet.textContent = COVER_PHOTO_FRAMES;
    document.head.appendChild(sheet);
  }
  return {
    animationName: which === "photo" ? "mifotito-cover-photo" : "mifotito-cover-paper",
    animationDuration: `${durationMs}ms`,
    animationTimingFunction: "linear",
    animationFillMode: "both",
    animationDirection: open ? "normal" : "reverse",
  };
}

function webStyle(style: Record<string, unknown>) {
  return style as object;
}

function PanelFace({
  width,
  height,
  color,
  photo,
  overlay,
  onLight = false,
  half = null,
}: {
  width: number;
  height: number;
  color: string;
  photo: PanelPhoto | null;
  overlay: TextOverlay | null;
  onLight?: boolean;
  half?: "top" | "bottom" | null;
}) {
  const crop = photo?.crop;
  const source = photo?.source?.source ?? (photo?.source?.uri ? { uri: photo.source.uri } : null);
  const fitted = overlay?.text
    ? layoutCardText(
        overlay.text,
        width,
        height,
        (line, size) => Math.max(1, [...line].length) * size * fontById(overlay.font).width * 1.12,
        overlay.size * height,
        CARD_TEXT_MIN_PX,
      )
    : null;
  const blockH = fitted ? fitted.lines.length * fitted.leading : 0;
  const paragraph = Boolean(overlay && (overlay.text.includes("\n") || [...overlay.text].length > 48));
  const top = fitted
    ? paragraph
      ? Math.max(8, (height - blockH) / 2)
      : Math.min(Math.max(4, overlay!.y * height - blockH / 2), Math.max(4, height - blockH - 4))
    : 0;
  return (
    <View style={{ width, height, backgroundColor: color, overflow: "hidden", borderWidth: 1, borderColor: "rgba(42,27,22,0.28)", ...foldEdge(half), boxShadow: half ? "none" : "0 10px 24px rgba(42,27,22,0.12)" }}>
      {photo?.id === "asset:sample" && crop ? (
        <SampleScene
          style={{
            position: "absolute",
            width: (width * crop.imageWidth) / crop.width,
            height: (height * crop.imageHeight) / crop.height,
            left: (-crop.x * width) / crop.width,
            top: (-crop.y * height) / crop.height,
          }}
        />
      ) : source && crop ? (
        <Image
          source={source}
          contentFit="fill"
          style={{
            position: "absolute",
            width: (width * crop.imageWidth) / crop.width,
            height: (height * crop.imageHeight) / crop.height,
            left: (-crop.x * width) / crop.width,
            top: (-crop.y * height) / crop.height,
          }}
        />
      ) : null}
      {fitted && overlay ? (
        <View style={{ position: "absolute", left: width * 0.08, top, width: width * 0.84 }}>
          <Text style={{ fontFamily: fontById(overlay.font).family, fontSize: fitted.size, lineHeight: fitted.leading, color: onLight && overlay.color.toLowerCase() === "#ffffff" ? colors.ink : overlay.color, textAlign: "center" }}>{fitted.lines.join("\n")}</Text>
        </View>
      ) : null}
    </View>
  );
}

function chip(on: boolean) {
  return { minHeight: 44, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center" as const, backgroundColor: on ? colors.ink : colors.white };
}
function chipText(on: boolean) {
  return { fontFamily: font.semibold, color: on ? "white" : colors.ink, fontSize: 13 };
}
