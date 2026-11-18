import { useEffect, useState } from "react";
import { AccessibilityInfo, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from "react-native-reanimated";
import { formatSoles } from "../lib/money";
import { remainingParts, type Guarantee } from "../lib/cutoff";
import { colors, font } from "./theme";

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    const apply = (value: boolean) => {
      if (live) setReduced(value);
    };
    AccessibilityInfo.isReduceMotionEnabled().then((value) => apply(Boolean(value)));
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", apply);
    let query: MediaQueryList | null = null;
    const onQuery = () => apply(Boolean(query?.matches) || reduced);
    if (Platform.OS === "web" && typeof window !== "undefined" && "matchMedia" in window) {
      query = window.matchMedia("(prefers-reduced-motion: reduce)");
      if (query.matches) apply(true);
      query.addEventListener?.("change", onQuery);
    }
    return () => {
      live = false;
      sub.remove();
      query?.removeEventListener?.("change", onQuery);
    };
  }, [reduced]);
  return reduced;
}

export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function PriceTicker({ cents }: { cents: number }) {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(cents);
  useEffect(() => {
    if (reduced) {
      setShown(cents);
      return;
    }
    const from = shown;
    const start = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      const progress = Math.min(1, (time - start) / 520);
      const eased = 1 - (1 - progress) ** 3;
      setShown(Math.round(from + (cents - from) * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // The tick starts from the value already on screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cents, reduced]);
  return <Text style={styles.price}>{formatSoles(shown)}</Text>;
}

export function Countdown({ target, now }: { target: Date; now: Date }) {
  const parts = remainingParts(now, target);
  const cells = [
    ["días", parts.days],
    ["horas", parts.hours],
    ["min", parts.minutes],
    ["seg", parts.seconds],
  ] as const;
  return (
    <View style={styles.countRow}>
      {cells.map(([label, value]) => (
        <View key={label} style={styles.countCell}>
          <Text style={styles.countValue}>{String(value).padStart(2, "0")}</Text>
          <Text style={styles.countLabel}>{label}</Text>
        </View>
      ))}
    </View>
  );
}

export function GuaranteeNote({ guarantee, align }: { guarantee: Guarantee; align?: "center" }) {
  const centered = align === "center" ? ({ textAlign: "center" as const } ) : null;
  return (
    <View style={[styles.note, { backgroundColor: guarantee.guaranteed ? "#E7F6EE" : "#FFF1DE" }]}>
      <Text style={[styles.noteTitle, centered, { color: guarantee.guaranteed ? colors.good : colors.warn }]}>{guarantee.headline}</Text>
      <Text style={[styles.noteBody, centered]}>{guarantee.detail}</Text>
    </View>
  );
}

const ORNAMENTS = [
  { x: "6%", delay: 0, color: "#C5363C", kind: "ball" },
  { x: "22%", delay: 400, color: "#E8C56B", kind: "star" },
  { x: "38%", delay: 900, color: "#1C4D3A", kind: "ball" },
  { x: "54%", delay: 200, color: "#F4EFE8", kind: "ball" },
  { x: "70%", delay: 1100, color: "#C5363C", kind: "star" },
  { x: "84%", delay: 600, color: "#E8C56B", kind: "ball" },
];

export function Ornaments({ kind }: { kind: "navidad" | "hearts" | "none" }) {
  const reduced = useReducedMotion();
  if (reduced || kind === "none") return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {ORNAMENTS.map((item, index) => (
        <Faller key={`${kind}-${index}`} left={item.x} delay={item.delay} color={kind === "hearts" ? "#E06B86" : item.color} heart={kind === "hearts"} />
      ))}
    </View>
  );
}

function Faller({ left, delay, color, heart }: { left: string; delay: number; color: string; heart: boolean }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(delay, withRepeat(withTiming(1, { duration: 9000, easing: Easing.linear }), -1, false));
  }, [delay, progress]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: -30 + progress.value * 760 }, { rotate: `${progress.value * 180}deg` }],
    opacity: 0.85,
  }));
  return (
    <Animated.View style={[{ position: "absolute", left: left as `${number}%`, top: 0 }, style]}>
      <View style={[heart ? styles.heart : styles.ball, { backgroundColor: color, borderRadius: heart ? 4 : 99 }]} />
    </Animated.View>
  );
}

export function GiftSuccess({ title, body }: { title: string; body: string }) {
  const reduced = useReducedMotion();
  const lid = useSharedValue(reduced ? -20 : 0);
  const card = useSharedValue(reduced ? 0 : 30);
  useEffect(() => {
    if (reduced) return;
    lid.value = withDelay(200, withTiming(-36, { duration: 700, easing: Easing.out(Easing.cubic) }));
    card.value = withDelay(500, withTiming(-8, { duration: 800, easing: Easing.out(Easing.cubic) }));
  }, [card, lid, reduced]);
  const lidStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lid.value }, { rotate: "-8deg" }] }));
  const cardStyle = useAnimatedStyle(() => ({ transform: [{ translateY: card.value }] }));
  return (
    <View style={{ alignItems: "center", gap: 16, minHeight: 280 }}>
      {!reduced ? <Confetti /> : null}
      <View style={styles.giftWrap}>
        <Animated.View style={[styles.giftCard, cardStyle]}>
          <Text style={styles.giftCardText}>un recuerdo</Text>
        </Animated.View>
        <View style={styles.box} />
        <Animated.View style={[styles.lid, lidStyle]} />
      </View>
      <Text style={styles.successTitle}>{title}</Text>
      <Text style={styles.successBody}>{body}</Text>
    </View>
  );
}

function Confetti() {
  const bits = Array.from({ length: 16 }, (_, index) => index);
  return (
    <View pointerEvents="none" style={styles.confetti}>
      {bits.map((bit) => (
        <Bit key={bit} index={bit} />
      ))}
    </View>
  );
}

function Bit({ index }: { index: number }) {
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.value = withDelay(index * 40, withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }));
  }, [index, progress]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.value,
    transform: [
      { translateX: Math.cos(index) * 120 * progress.value },
      { translateY: -40 - progress.value * (80 + (index % 5) * 24) },
      { rotate: `${progress.value * 180}deg` },
    ],
  }));
  const palette = ["#C5363C", "#E8C56B", "#1C4D3A", "#F7F1E8", "#8C2429"];
  return <Animated.View style={[styles.bit, { backgroundColor: palette[index % palette.length], left: "46%" }, style]} />;
}

export function PaySheet({
  method,
  total,
  onApprove,
  onReject,
}: {
  method: "card" | "yape" | "plin";
  total: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  const copy = {
    card: { title: "Mercado Pago de prueba", body: "Simula una tarjeta aprobada. En vivo esto abre el pago de Mercado Pago." },
    yape: { title: "Yape de prueba", body: "Simula el pago con Yape. En vivo se cobra por el proveedor configurado." },
    plin: { title: "Plin de prueba", body: "Simula la confirmación de Plin. En vivo mostramos el número de la tienda." },
  }[method];
  return (
    <View style={styles.sheet}>
      <Text style={styles.sheetEyebrow}>Pago de prueba</Text>
      <Text style={styles.sheetTitle}>{copy.title}</Text>
      <Text style={styles.successBody}>{copy.body}</Text>
      <Text style={styles.price}>{total}</Text>
      <Pressable style={styles.approve} onPress={onApprove}>
        <Text style={styles.approveText}>Aprobar pago</Text>
      </Pressable>
      <Pressable onPress={onReject}>
        <Text style={styles.reject}>Rechazar</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  price: { fontFamily: font.display, fontSize: 36, color: colors.ink },
  countRow: { flexDirection: "row", gap: 8 },
  countCell: { flex: 1, backgroundColor: colors.ink, borderRadius: 16, paddingVertical: 10, alignItems: "center" },
  countValue: { fontFamily: font.display, color: "#FFF8F1", fontSize: 22 },
  countLabel: { fontFamily: font.medium, color: "#E7C7B8", fontSize: 11 },
  note: { borderRadius: 18, padding: 14, gap: 4 },
  noteTitle: { fontFamily: font.bold, fontSize: 16 },
  noteBody: { fontFamily: font.body, color: colors.ink, lineHeight: 21 },
  ball: { width: 18, height: 18 },
  heart: { width: 16, height: 16, transform: [{ rotate: "45deg" }] },
  giftWrap: { width: 180, height: 180, alignItems: "center", justifyContent: "flex-end" },
  box: { width: 140, height: 90, backgroundColor: colors.red, borderBottomLeftRadius: 12, borderBottomRightRadius: 12 },
  lid: { position: "absolute", top: 48, width: 156, height: 28, backgroundColor: colors.redDark, borderRadius: 8 },
  giftCard: { position: "absolute", top: 62, width: 110, height: 72, backgroundColor: "#FFF8F1", borderRadius: 12, alignItems: "center", justifyContent: "center" },
  giftCardText: { fontFamily: font.displaySoft, color: colors.ink },
  successTitle: { fontFamily: font.display, fontSize: 32, lineHeight: 36, color: colors.ink, textAlign: "center" },
  successBody: { fontFamily: font.body, color: colors.muted, textAlign: "center", lineHeight: 22 },
  confetti: { position: "absolute", top: 20, left: 0, right: 0, height: 160 },
  bit: { position: "absolute", width: 8, height: 14, borderRadius: 2 },
  sheet: { backgroundColor: colors.card, borderRadius: 24, padding: 18, gap: 10, borderWidth: 1, borderColor: colors.line },
  sheetEyebrow: { fontFamily: font.bold, color: colors.red, letterSpacing: 1, fontSize: 12 },
  sheetTitle: { fontFamily: font.display, fontSize: 28, color: colors.ink },
  approve: { backgroundColor: colors.pine, minHeight: 52, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  approveText: { color: "white", fontFamily: font.bold, fontSize: 16 },
  reject: { textAlign: "center", fontFamily: font.medium, color: colors.bad, padding: 8 },
});
