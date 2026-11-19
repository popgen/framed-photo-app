import { router } from "expo-router";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Svg, { Path, Rect } from "react-native-svg";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useEffect } from "react";
import { FrameView } from "../components/FrameView";
import { Countdown, GuaranteeNote, Ornaments, useNow, useReducedMotion } from "../components/fx";
import { useRepo } from "../components/provider";
import { Button, Card, H1, P, Screen, TabBar, WhatsAppButton } from "../components/ui";
import { colors, font } from "../components/theme";
import { cardsPromoVisible, countdownVisible, motionEnabled, ornamentKind } from "../lib/campaign";
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
        <P style={centered}>{active.heroSubtitle}</P>
        {countdownVisible(now, active) ? <Countdown target={countdownTarget(now, null, active)} now={now} /> : null}
        <GuaranteeNote guarantee={guarantee} align="center" />
        <View style={{ alignItems: "center" }}>
          <Button label={active.cta} onPress={() => router.push("/crear")} />
        </View>
        <Animated.View entering={reduced ? undefined : FadeInDown.springify().damping(14)} style={{ alignItems: "center", paddingTop: 8 }}>
          <FrameView frame={frameById("wood-15")} photoId="asset:sample" crop={crop} width={230} animateSample />
        </Animated.View>
        {cardsPromoVisible(now, active) && active.cardsPromo ? (
          <Pressable accessibilityRole="button" accessibilityLabel={active.cardsPromo.cta} onPress={() => router.push("/tarjeta")}>
            <View style={cardPromo}>
              <FoldAccent reduced={reduced} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontFamily: font.displaySoft, fontSize: 18, color: colors.ink, textAlign: "center" }}>{active.cardsPromo.headline}</Text>
                <Text style={{ fontFamily: font.body, color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: "center" }}>
                  {active.cardsPromo.detail.replace("{price}", formatSoles(priceCards(1).cents))}
                </Text>
                <Text style={{ fontFamily: font.bold, color: colors.red, marginTop: 4, textAlign: "center" }}>{active.cardsPromo.cta}</Text>
              </View>
            </View>
          </Pressable>
        ) : null}
        <Text style={section}>Super simple</Text>
        <Step n="1" title="Elige tu foto" body="Desde el teléfono, iCloud o una foto de ejemplo." icon={<PhotoIcon />} />
        <Step n="2" title="Elige tu marco" body="Desliza los marcos, o arma una tarjeta navideña." icon={<FrameIcon />} />
        <Step n="3" title="Llega a tu casa en días" body="Impresa, con acrílico, hasta la puerta." icon={<HomeIcon />} />
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
          <P style={centered}>Arma un trío, una cuadrícula o un mixto. El segundo marco va con 20% y desde el tercero el set baja 15%.</P>
          <Button label="Armar mi muro" tone="ghost" onPress={() => router.push("/muro")} />
        </Card>
        {active.giftWrapFeatured ? (
          <Card>
            <Text style={section}>{active.giftWrapTitle}</Text>
            <P style={centered}>{active.giftWrapBody} S/ 10. La caja va sin precios.</P>
          </Card>
        ) : null}
        <Text style={section}>Lo que cuentan</Text>
        {(reviews ?? []).map((review) => (
          <Card key={review.id}>
            <Text style={{ color: colors.gold, fontFamily: font.bold, textAlign: "center" }}>{"★".repeat(review.stars)}</Text>
            <P style={centered}>“{review.quote}”</P>
            <Text style={{ fontFamily: font.semibold, color: colors.ink, textAlign: "center" }}>{review.author} · {review.city}</Text>
          </Card>
        ))}
        <Pressable onPress={() => router.push("/retablo")}>
          <Card>
            <Text style={section}>¿Quieres un retablo de verdad?</Text>
            <P style={centered}>Tres hojas de madera, hechas a mano. No se compra aquí: solo cuéntanos el tamaño.</P>
          </Card>
        </Pressable>
        <Pressable onPress={() => router.push("/regalo")}>
          <Card>
            <Text style={section}>Tarjeta de regalo</Text>
            <P style={centered}>Regala soles para un marco. Llega por WhatsApp.</P>
          </Card>
        </Pressable>
        <Pressable accessibilityRole="link" accessibilityLabel="Haz clic aquí para rastrear tu pedido" onPress={() => router.push("/rastrear")} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 }}>
          <Svg width={18} height={18} viewBox="0 0 24 24">
            <Path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" fill="none" stroke={colors.red} strokeWidth="1.8" />
            <Path d="M12 10.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2Z" fill={colors.red} />
          </Svg>
          <Text style={{ fontFamily: font.semibold, color: colors.ink, textAlign: "center" }}>Haz clic aquí para rastrear tu pedido</Text>
        </Pressable>
      </View>
      <WhatsAppButton />
    </Screen>
  );
}

function FoldAccent({ reduced }: { reduced: boolean }) {
  const fold = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    fold.value = withRepeat(withTiming(1, { duration: 1400 }), -1, true);
  }, [fold, reduced]);
  const left = useAnimatedStyle(() => ({ transform: [{ perspective: 180 }, { rotateY: `${-32 * fold.value}deg` }] }));
  const right = useAnimatedStyle(() => ({ transform: [{ perspective: 180 }, { rotateY: `${32 * fold.value}deg` }] }));
  return (
    <View style={{ width: 54, height: 40, flexDirection: "row", alignItems: "center" }}>
      <Animated.View style={[{ width: 16, height: 36, backgroundColor: "#1C4D3A", borderTopLeftRadius: 4, borderBottomLeftRadius: 4 }, left]} />
      <View style={{ width: 18, height: 36, backgroundColor: colors.red }} />
      <Animated.View style={[{ width: 16, height: 36, backgroundColor: "#C4924A", borderTopRightRadius: 4, borderBottomRightRadius: 4 }, right]} />
    </View>
  );
}

function Step({ n, title, body, icon }: { n: string; title: string; body: string; icon: ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.delay(Number(n) * 90).springify().damping(14)}>
      <Card>
        <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
          <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: colors.red, alignItems: "center", justifyContent: "center" }}>
            {icon}
            <Text style={{ fontFamily: font.display, fontSize: 18, color: "white", marginTop: 2 }}>{n}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: font.displaySoft, fontSize: 22, color: colors.ink, textAlign: "center" }}>{title}</Text>
            <P style={centered}>{body}</P>
          </View>
        </View>
      </Card>
    </Animated.View>
  );
}

function PhotoIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="#fff" strokeWidth="1.8" />
      <Path d="M8 14l2.2-2.4 1.8 1.8L15 10l4 5" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
    </Svg>
  );
}

function FrameIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Rect x="4" y="3" width="16" height="18" rx="1.5" fill="none" stroke="#fff" strokeWidth="1.8" />
      <Rect x="7.5" y="6.5" width="9" height="11" fill="none" stroke="#fff" strokeWidth="1.4" />
    </Svg>
  );
}

function HomeIcon() {
  return (
    <Svg width={22} height={22} viewBox="0 0 24 24">
      <Path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-8.5Z" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinejoin="round" />
    </Svg>
  );
}

function Tier({ title, price, body }: { title: string; price: string; body: string }) {
  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 12 }}>
        <Text style={{ fontFamily: font.displaySoft, fontSize: 22, color: colors.ink, textAlign: "center" }}>{title}</Text>
        <Text style={{ fontFamily: font.bold, color: colors.red, textAlign: "center" }}>{price}</Text>
      </View>
      <P style={centered}>{body}</P>
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

const section = { fontFamily: font.displaySoft, fontSize: 22, color: colors.ink, marginBottom: 6, textAlign: "center" as const };
const centered = { textAlign: "center" as const };
const cardPromo = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  gap: 12,
  backgroundColor: "#F3EBD8",
  borderRadius: 20,
  padding: 14,
  borderWidth: 1,
  borderColor: "#E4D3B4",
};
