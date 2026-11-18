import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { TextStyleEditor } from "../components/TextStyleEditor";
import { useReducedMotion } from "../components/fx";
import { Button, Card, Screen, TabBar } from "../components/ui";
import { colors, font } from "../components/theme";
import { cardGreetings, cardSizes, cardTemplates, defaultCardSize, messageLimits, priceCards, type CardSnapshot } from "../lib/cards";
import { formatSoles } from "../lib/money";
import { uid } from "../lib/ids";
import { useCart } from "../lib/store";
import type { TextOverlay } from "../lib/overlay";

const PANELS = ["Portada", "Interior", "Contraportada"] as const;

export default function Tarjeta() {
  const reduced = useReducedMotion();
  const add = useCart((state) => state.add);
  const [sizeId, setSizeId] = useState(defaultCardSize().id);
  const [templateId, setTemplateId] = useState(cardTemplates[0].id);
  const [envelope, setEnvelope] = useState("kraft");
  const [qty, setQty] = useState(1);
  const [panel, setPanel] = useState<(typeof PANELS)[number]>("Portada");
  const [open, setOpen] = useState(false);
  const [bleed, setBleed] = useState(false);
  const [frontMessage, setFrontMessage] = useState<TextOverlay | null>(null);
  const [insideMessage, setInsideMessage] = useState<TextOverlay | null>(null);
  const size = cardSizes.find((item) => item.id === sizeId) ?? defaultCardSize();
  const template = cardTemplates.find((item) => item.id === templateId) ?? cardTemplates[0];
  const limits = messageLimits(size);
  const priced = priceCards(qty);

  function save() {
    const card: CardSnapshot = {
      sizeId: size.id,
      quantity: qty,
      envelopeColor: envelope,
      templateId: template.id,
      frontMessage,
      insideMessage,
      photos: {},
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
        <Text style={{ fontFamily: font.body, color: colors.muted }}>Tres paneles, dos pliegues y un sobre. Más barata que un marco.</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {cardSizes.map((item) => (
            <Pressable key={item.id} onPress={() => setSizeId(item.id)} style={chip(item.id === size.id)}>
              <Text style={chipText(item.id === size.id)}>{item.name}</Text>
            </Pressable>
          ))}
        </View>
        {size.printShop ? <Text style={{ fontFamily: font.semibold, color: colors.bad }}>{size.shopFlag}</Text> : (
          <Text style={{ fontFamily: font.body, color: colors.muted }}>Hoja plana {size.flatWmm}×{size.flatHmm} mm. Sobre {size.envelopeName} {size.envelopeWmm}×{size.envelopeHmm} mm.</Text>
        )}
        <View style={{ flexDirection: "row", gap: 8 }}>
          {cardTemplates.map((item) => (
            <Pressable key={item.id} onPress={() => setTemplateId(item.id)} style={chip(item.id === template.id)}>
              <Text style={chipText(item.id === template.id)}>{item.name}</Text>
            </Pressable>
          ))}
        </View>
        <Animated.View entering={reduced ? undefined : FadeIn.duration(400)} style={{ alignItems: "center" }}>
          <Pressable onPress={() => setOpen((value) => !value)} accessibilityLabel="Abrir la tarjeta">
            <View style={{ width: 280, height: 150, flexDirection: "row", transform: [{ rotateX: open ? "8deg" : "0deg" }] }}>
              <Fold panel="back" color={open ? template.inside : template.outside} open={open} text={open ? "" : ""} />
              <Fold panel="front" color={open ? template.inside : template.outside} open={open} text={open ? insideMessage?.text ?? "" : frontMessage?.text ?? ""} family={open ? insideMessage?.font : frontMessage?.font} ink={open ? insideMessage?.color : frontMessage?.color} />
              <Fold panel="flap" color={open ? template.inside : template.outside} open={open} text="" />
            </View>
          </Pressable>
          <Text style={{ fontFamily: font.medium, color: colors.muted, marginTop: 6 }}>{open ? "Interior" : "Portada"} · toca para {open ? "cerrar" : "abrir"}</Text>
        </Animated.View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {PANELS.map((item) => (
            <Pressable key={item} onPress={() => { setPanel(item); setOpen(item === "Interior"); }} style={chip(panel === item)}>
              <Text style={chipText(panel === item)}>{item}</Text>
            </Pressable>
          ))}
        </View>
        {panel === "Portada" ? (
          <Card>
            <TextStyleEditor label="Mensaje de portada" value={frontMessage} onChange={setFrontMessage} maxChars={limits.front} presets={cardGreetings} />
          </Card>
        ) : null}
        {panel === "Interior" ? (
          <Card>
            <TextStyleEditor label="Mensaje interior" value={insideMessage} onChange={setInsideMessage} maxChars={limits.inside} multiline presets={cardGreetings} />
          </Card>
        ) : null}
        {panel === "Contraportada" ? <Text style={{ fontFamily: font.body, color: colors.muted }}>La contraportada queda para la foto. El mensaje va en la portada y en el interior.</Text> : null}
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

function Fold({ color, text, family, ink }: { panel: string; color: string; open: boolean; text: string; family?: string; ink?: string }) {
  return (
    <View style={{ flex: 1, marginHorizontal: 2, backgroundColor: color, borderRadius: 6, alignItems: "center", justifyContent: "center", padding: 6 }}>
      <Text numberOfLines={4} style={{ fontFamily: family ? fontName(family) : font.body, color: ink || colors.ink, textAlign: "center", fontSize: 13 }}>{text}</Text>
    </View>
  );
}

function fontName(id: string) {
  const map: Record<string, string> = {
    pacifico: "Pacifico_400Regular",
    dancing: "DancingScript_600SemiBold",
    vibes: "GreatVibes_400Regular",
    lobster: "Lobster_400Regular",
    satisfy: "Satisfy_400Regular",
    amatic: "AmaticSC_700Bold",
  };
  return map[id] ?? font.body;
}

function chip(on: boolean) {
  return { minHeight: 44, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center" as const, backgroundColor: on ? colors.ink : colors.white };
}
function chipText(on: boolean) {
  return { fontFamily: font.semibold, color: on ? "white" : colors.ink, fontSize: 13 };
}
