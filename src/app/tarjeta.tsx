import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
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
  const size = cardSizes.find((item) => item.id === sizeId) ?? defaultCardSize();
  const template = cardTemplates.find((item) => item.id === templateId) ?? cardTemplates[0];
  const limits = messageLimits(size);
  const priced = priceCards(qty);

  async function place(which: PanelName, photo: { id: string; width: number; height: number }) {
    const crop = centeredCrop(photo.width, photo.height, size.panelWmm, size.panelHmm);
    const source = await resolvePhoto(photo.id);
    const next = { ...photo, crop, source };
    if (which === "Portada") setFrontPhoto(next);
    else setInsidePhoto(next);
  }

  function save() {
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
        <View>
          <View style={{ padding: 16, gap: 8, backgroundColor: colors.bg }}>
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
                <Text style={{ fontFamily: font.semibold, color: colors.ink, marginBottom: 8 }}>Encadra la foto</Text>
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
              onSample={() => void place("Portada", samplePhoto())}
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
  onPress: () => void;
}) {
  const panelW = 196;
  const panelH = Math.round(panelW * A5_PANEL_RATIO);
  const motion = foldPreview(open, reduced);
  const timing = {
    transitionDuration: `${motion.durationMs}ms`,
    transitionProperty: motion.property,
    transitionTimingFunction: "cubic-bezier(0.45, 0.05, 0.2, 1)",
  } as const;
  return (
    <View style={{ alignItems: "center", marginTop: !reduced && open ? Math.round(panelH * 0.55) : 0, ...timing }}>
      <Pressable onPress={onPress} accessibilityLabel={motion.hint}>
        <View style={{ width: panelW, height: panelH, transform: [{ perspective: 1100 }] }}>
          <View style={{ position: "absolute", top: 0, left: 0, width: panelW, height: panelH, opacity: motion.insideOpacity, ...timing }}>
            <PanelFace width={panelW} height={panelH} color={inside} photo={null} overlay={insideMessage} onLight />
          </View>
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: panelW,
              height: panelH,
              zIndex: 2,
              opacity: motion.frontOpacity,
              transformOrigin: motion.origin,
              backfaceVisibility: "hidden",
              transform: [{ perspective: 1100 }, { rotateX: motion.rotateX }],
              boxShadow: open && !reduced ? "0 22px 28px rgba(42,27,22,0.28)" : "0 8px 16px rgba(42,27,22,0.16)",
              ...timing,
            }}
          >
            <PanelFace width={panelW} height={panelH} color={outside} photo={frontPhoto} overlay={frontMessage} />
          </View>
        </View>
      </Pressable>
      <Text style={{ fontFamily: font.medium, color: colors.muted, marginTop: 8 }}>{motion.hint}</Text>
    </View>
  );
}

function PanelFace({
  width,
  height,
  color,
  photo,
  overlay,
  onLight = false,
}: {
  width: number;
  height: number;
  color: string;
  photo: PanelPhoto | null;
  overlay: TextOverlay | null;
  onLight?: boolean;
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
    <View style={{ width, height, backgroundColor: color, overflow: "hidden", borderWidth: 1, borderColor: "rgba(42,27,22,0.28)", borderRadius: 10, boxShadow: "0 10px 24px rgba(42,27,22,0.12)" }}>
      {source && crop ? (
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
