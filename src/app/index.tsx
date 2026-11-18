import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { FrameView } from "../components/FrameView";
import { Countdown, GuaranteeNote, Ornaments, useNow, useReducedMotion } from "../components/fx";
import { useRepo } from "../components/provider";
import { Button, Card, H1, P, Screen, TabBar, WhatsAppButton } from "../components/ui";
import { colors, font } from "../components/theme";
import { countdownVisible, motionEnabled, ornamentKind } from "../lib/campaign";
import { countdownTarget, guaranteeFor } from "../lib/cutoff";
import { frameById, frames } from "../lib/catalog";
import { priceCards } from "../lib/cards";
import { formatSoles } from "../lib/money";
import { centeredCrop } from "../lib/print-size";
import samples from "../../data/samples.json";

export default function Home() {
  const now = useNow();
  const reduced = useReducedMotion();
  const { data: campaign } = useRepo((repo) => repo.getCampaign());
  const { data: reviews } = useRepo((repo) => repo.listReviews());
  const active = campaign;
  if (!active) return <Screen><P> </P></Screen>;
  const motion = motionEnabled(active);
  const guarantee = guaranteeFor(now, null, active);
  const crop = centeredCrop(samples.sample.width, samples.sample.height, 3, 4);
  return (
    <Screen seasonal={motion ? <Ornaments kind={ornamentKind(active)} /> : null} footer={<TabBar />}>
      <View style={{ padding: 20, gap: 18 }}>
        <View style={wordmark} accessibilityRole="header" accessibilityLabel="Mi Fotito">
          <PeruFlag />
          <Text numberOfLines={1} style={wordmarkText}>
            Mi Fotito
          </Text>
        </View>
        <H1>{active.heroTitle}</H1>
        <P>{active.heroSubtitle}</P>
        {countdownVisible(now, active) ? <Countdown target={countdownTarget(now, null, active)} now={now} /> : null}
        <GuaranteeNote guarantee={guarantee} />
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Button label={active.cta} onPress={() => router.push("/crear")} />
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={() => router.push("/crear")} style={choice(true)}><Text style={choiceText(true)}>Marco</Text></Pressable>
          <Pressable onPress={() => router.push("/tarjeta")} style={choice(false)}><Text style={choiceText(false)}>Tarjeta navideña · {formatSoles(priceCards(1).cents)}</Text></Pressable>
        </View>
        <Animated.View entering={reduced ? undefined : FadeInDown.springify().damping(14)} style={{ alignItems: "center", paddingTop: 8 }}>
          <FrameView frame={frameById("wood-15")} photoId="asset:sample" crop={crop} width={230} />
        </Animated.View>
        <Text style={section}>Super simple</Text>
        <Step n="1" title="Elige tu foto" body="Desde el teléfono, iCloud o una foto de ejemplo." />
        <Step n="2" title="Elige tu marco" body="Desliza los marcos, o arma una tarjeta navideña." />
        <Step n="3" title="Llega a tu casa en días" body="Impresa, con acrílico, hasta la puerta." />
        <Text style={section}>Marcos de Navidad</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {frames.filter((item) => item.category === "navidad").slice(0, 3).map((item) => (
            <Pressable key={item.id} onPress={() => router.push("/crear")} style={{ alignItems: "center", width: "32%" }}>
              <FrameView frame={item} width={96} />
              <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.ink, textAlign: "center" }}>{item.name}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={section}>Los marcos</Text>
        <Tier title="Básico" price="S/ 59" body="15×20 y el cuadrado 20×20. Patita de mesa, acrílico y envío incluido." />
        <Tier title="Muro" price="S/ 109" body="30×40 para colgar. Negro, blanco o madera." />
        <Tier title="Premium" price="S/ 129" body="Foto 15×20 dentro de un 30×40 con paspartú blanco." />
        <Card>
          <Text style={section}>Un muro, no un marco</Text>
          <P>Arma un trío, una cuadrícula o un mixto. El segundo marco va con 20% y desde el tercero el set baja 15%.</P>
          <Button label="Armar mi muro" tone="ghost" onPress={() => router.push("/muro")} />
        </Card>
        {active.giftWrapFeatured ? (
          <Card>
            <Text style={section}>{active.giftWrapTitle}</Text>
            <P>{active.giftWrapBody} S/ 10. La caja va sin precios.</P>
          </Card>
        ) : null}
        <Text style={section}>Lo que cuentan</Text>
        {(reviews ?? []).map((review) => (
          <Card key={review.id}>
            <Text style={{ color: colors.gold, fontFamily: font.bold }}>{"★".repeat(review.stars)}</Text>
            <P>“{review.quote}”</P>
            <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{review.author} · {review.city}</Text>
          </Card>
        ))}
        <Pressable onPress={() => router.push("/retablo")}>
          <Card>
            <Text style={section}>¿Quieres un retablo de verdad?</Text>
            <P>Tres hojas de madera, hechas a mano. No se compra aquí: solo cuéntanos el tamaño.</P>
          </Card>
        </Pressable>
        <Pressable onPress={() => router.push("/regalo")}>
          <Card>
            <Text style={section}>Gift card</Text>
            <P>Regala soles para un marco. Llega por WhatsApp.</P>
          </Card>
        </Pressable>
        <Pressable accessibilityRole="link" accessibilityLabel="Haz clic aquí para rastrear tu pedido" onPress={() => router.push("/rastrear")} style={{ minHeight: 48, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: font.semibold, color: colors.ink, textAlign: "center" }}>Haz clic aquí para rastrear tu pedido</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/pedido/demo-lima")}>
          <Text style={{ fontFamily: font.medium, color: colors.muted, textAlign: "center" }}>Ver un pedido de ejemplo</Text>
        </Pressable>
      </View>
      <WhatsAppButton />
    </Screen>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.delay(Number(n) * 80).springify().damping(14)}>
      <Card>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.red, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: font.display, fontSize: 24, color: "white" }}>{n}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.displaySoft, fontSize: 22, color: colors.ink }}>{title}</Text>
            <P>{body}</P>
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

function choice(on: boolean) {
  return { flex: 1, minHeight: 48, borderRadius: 999, alignItems: "center" as const, justifyContent: "center" as const, backgroundColor: on ? colors.ink : colors.white, paddingHorizontal: 10 };
}
function choiceText(on: boolean) {
  return { fontFamily: font.semibold, color: on ? "white" : colors.ink, textAlign: "center" as const };
}

function Tier({ title, price, body }: { title: string; price: string; body: string }) {
  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ fontFamily: font.displaySoft, fontSize: 22, color: colors.ink }}>{title}</Text>
        <Text style={{ fontFamily: font.bold, color: colors.red }}>{price}</Text>
      </View>
      <P>{body}</P>
    </Card>
  );
}

function PeruFlag() {
  return (
    <View style={{ width: 22, height: 15, flexDirection: "row", borderRadius: 2, overflow: "hidden" }}>
      <View style={{ flex: 1, backgroundColor: "#D91023" }} />
      <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />
      <View style={{ flex: 1, backgroundColor: "#D91023" }} />
    </View>
  );
}

const wordmark = {
  width: "100%" as const,
  alignItems: "center" as const,
  gap: 8,
};

const wordmarkText = {
  fontFamily: "Pacifico_400Regular, cursive",
  fontSize: 40,
  lineHeight: 48,
  color: colors.ink,
  textAlign: "center" as const,
};

const section = { fontFamily: font.displaySoft, fontSize: 22, color: colors.ink, marginBottom: 6 };
