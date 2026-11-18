import { router, usePathname } from "expo-router";
import { ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import * as Haptics from "expo-haptics";
import { supportNumber } from "../lib/env";
import { colors, font } from "./theme";

export function Screen({
  children,
  footer,
  scroll = true,
  seasonal,
}: {
  children: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  seasonal?: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView contentContainerStyle={{ paddingBottom: footer ? 24 : 28 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={{ flex: 1 }}>{children}</View>
  );
  return (
    <View style={[styles.outer, { paddingTop: insets.top }]}>
      <View style={styles.column}>
        {seasonal}
        {body}
        {footer}
      </View>
    </View>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return <Text style={styles.h1}>{children}</Text>;
}

export function P({ children, style }: { children: ReactNode; style?: ViewStyle | object }) {
  return <Text style={[styles.p, style]}>{children}</Text>;
}

export function Button({
  label,
  onPress,
  tone = "primary",
  disabled,
}: {
  label: string;
  onPress: () => void;
  tone?: "primary" | "ghost" | "pine";
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => {
        if (disabled) return;
        void Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [
        styles.button,
        tone === "ghost" && styles.ghost,
        tone === "pine" && styles.pine,
        disabled && styles.disabled,
        pressed && !disabled && { transform: [{ scale: 0.98 }] },
      ]}
    >
      <Text style={[styles.buttonText, tone === "ghost" && { color: colors.ink }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#A89488" style={styles.input} {...props} />
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: object }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Progress({ step }: { step: 1 | 2 | 3 }) {
  const labels = ["Foto", "Marco", "Entrega"];
  return (
    <View style={styles.progress} accessibilityRole="progressbar">
      {labels.map((label, index) => {
        const active = index < step;
        return (
          <View key={label} style={styles.progressItem}>
            <View style={[styles.dot, active && styles.dotOn]} />
            <Text style={[styles.progressLabel, active && { color: colors.ink }]}>{label}</Text>
          </View>
        );
      })}
    </View>
  );
}

export function TabBar() {
  const path = usePathname();
  const insets = useSafeAreaInsets();
  const tabs = [
    { href: "/", label: "Inicio", icon: "M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" },
    { href: "/crear", label: "Crear", icon: "M5 4h10l4 4v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm9 1.5V9h3.5" },
    { href: "/muro", label: "Muro", icon: "M3 5h7v7H3zm11 0h7v7h-7zM3 16h7v5H3zm11 0h7v5h-7z" },
    { href: "/carrito", label: "Carrito", icon: "M6 7h15l-1.5 9h-12zM6 7 5 4H2m6 16a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm8 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" },
  ];
  return (
    <View style={[styles.tabs, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {tabs.map((tab) => {
        const on = path === tab.href;
        return (
          <Pressable key={tab.href} accessibilityRole="button" accessibilityLabel={tab.label} onPress={() => router.push(tab.href as "/")} style={styles.tab}>
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path d={tab.icon} stroke={on ? colors.red : colors.muted} strokeWidth={1.8} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            </Svg>
            <Text style={[styles.tabLabel, on && { color: colors.red }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function WhatsAppButton() {
  const phone = supportNumber();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Escribir por WhatsApp"
      onPress={() => {
        const url = `https://wa.me/${phone}?text=${encodeURIComponent("Hola Recuerdo, quiero armar un marco.")}`;
        if (typeof window !== "undefined") window.open(url, "_blank");
      }}
      style={styles.wa}
    >
      <Text style={styles.waText}>WhatsApp</Text>
    </Pressable>
  );
}

export function Banner({ tone, text }: { tone: "warn" | "bad" | "good"; text: string }) {
  const background = tone === "good" ? "#E5F5EC" : tone === "warn" ? "#FFF1DE" : "#FDE8E6";
  const color = tone === "good" ? colors.good : tone === "warn" ? colors.warn : colors.bad;
  return (
    <View style={[styles.banner, { backgroundColor: background }]}>
      <Text style={{ color, fontFamily: font.medium, lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { flex: 1, backgroundColor: colors.bgDeep, alignItems: "center" },
  column: { flex: 1, width: "100%", maxWidth: 480, backgroundColor: colors.bg, position: "relative", overflow: "hidden" },
  h1: { fontFamily: font.display, fontSize: 34, lineHeight: 38, color: colors.ink, letterSpacing: -0.6 },
  p: { fontFamily: font.body, color: colors.muted, fontSize: 16, lineHeight: 23 },
  button: { backgroundColor: colors.red, minHeight: 54, borderRadius: 999, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  ghost: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: colors.line },
  pine: { backgroundColor: colors.pine },
  disabled: { opacity: 0.45 },
  buttonText: { color: colors.white, fontFamily: font.bold, fontSize: 16 },
  label: { fontFamily: font.medium, color: colors.ink, fontSize: 13 },
  input: {
    backgroundColor: colors.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.line,
    minHeight: 50,
    paddingHorizontal: 14,
    fontFamily: font.body,
    fontSize: 16,
    color: colors.ink,
  },
  card: { backgroundColor: colors.card, borderRadius: 24, padding: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.7)" },
  progress: { flexDirection: "row", gap: 8, marginBottom: 8 },
  progressItem: { flex: 1, gap: 6 },
  dot: { height: 4, borderRadius: 99, backgroundColor: "#E4D5C8" },
  dotOn: { backgroundColor: colors.red },
  progressLabel: { fontFamily: font.medium, fontSize: 12, color: colors.muted },
  tabs: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.line, backgroundColor: "rgba(255,252,249,0.96)", paddingTop: 8 },
  tab: { flex: 1, alignItems: "center", gap: 2, minHeight: 48 },
  tabLabel: { fontFamily: font.medium, fontSize: 11, color: colors.muted },
  wa: { position: "absolute", right: 16, bottom: 86, backgroundColor: "#1FA855", borderRadius: 999, paddingHorizontal: 14, paddingVertical: 10, zIndex: 5 },
  waText: { color: "white", fontFamily: font.bold, fontSize: 13 },
  banner: { borderRadius: 16, padding: 12 },
});
