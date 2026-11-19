import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View, type ViewStyle } from "react-native";
import Svg, { Rect } from "react-native-svg";
import { colors, font } from "./theme";

const PITCH = "¡Prueba nuestro creador de collages!";
const BENEFIT = "Junta hasta 12 fotos en un solo cuadro";
const CTA = "Haz un collage";

export function CollagePromo() {
  const keyboard = useKeyboardFocus();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Nuevo. ${PITCH} ${BENEFIT}. ${CTA}`}
      onPress={() => router.push("/collage")}
      onFocus={keyboard.focus}
      onBlur={keyboard.blur}
      style={({ pressed }) => [card, pressed && pressedCard, keyboard.on && focusRing, webPointer]}
    >
      <View style={row}>
        <CollageGlyph />
        <View style={copy}>
          <View style={badge}>
            <Text style={badgeText}>Nuevo</Text>
          </View>
          <Text style={pitch}>{PITCH}</Text>
          <Text style={benefit}>{BENEFIT}</Text>
        </View>
      </View>
      <View style={cta}>
        <Text style={ctaText}>{CTA}</Text>
      </View>
    </Pressable>
  );
}

function CollageGlyph() {
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={68} height={76} viewBox="0 0 68 76">
        <Rect x="1" y="1" width="66" height="74" rx="5" fill="#8C5A2B" />
        <Rect x="5" y="5" width="58" height="66" rx="3" fill="#C4924A" />
        <Rect x="9" y="9" width="50" height="58" rx="2" fill="#F6EFE6" />
        <Rect x="12" y="12" width="22" height="24" rx="1.5" fill={colors.red} />
        <Rect x="36" y="12" width="20" height="24" rx="1.5" fill="#F0D48A" />
        <Rect x="12" y="38" width="20" height="22" rx="1.5" fill={colors.pine} />
        <Rect x="34" y="38" width="22" height="22" rx="1.5" fill="#FFFCF9" />
      </Svg>
    </View>
  );
}

function useKeyboardFocus() {
  const viaKeyboard = useRef(false);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Tab") viaKeyboard.current = true;
    };
    const onPointer = () => {
      viaKeyboard.current = false;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, []);
  return {
    on,
    focus: () => setOn(viaKeyboard.current),
    blur: () => setOn(false),
  };
}

const webPointer = (Platform.OS === "web" ? { cursor: "pointer" } : null) as ViewStyle;

const focusRing = {
  borderColor: colors.ink,
  outlineStyle: "solid",
  outlineWidth: 3,
  outlineColor: colors.ink,
  outlineOffset: 3,
} as ViewStyle;

const card: ViewStyle = {
  backgroundColor: "#FFF4E4",
  borderRadius: 24,
  borderWidth: 2,
  borderColor: colors.red,
  padding: 14,
  gap: 12,
  minHeight: 44,
  shadowColor: "#241714",
  shadowOpacity: 0.12,
  shadowRadius: 14,
  shadowOffset: { width: 0, height: 6 },
  elevation: 3,
};

const pressedCard: ViewStyle = { transform: [{ scale: 0.985 }] };

const row: ViewStyle = { flexDirection: "row", alignItems: "center", gap: 12 };

const copy: ViewStyle = { flex: 1, minWidth: 0, gap: 4 };

const badge: ViewStyle = {
  alignSelf: "flex-start",
  backgroundColor: colors.pine,
  borderRadius: 999,
  paddingHorizontal: 8,
  paddingVertical: 2,
};

const badgeText = {
  fontFamily: font.bold,
  fontSize: 11,
  lineHeight: 16,
  color: colors.white,
  letterSpacing: 0.3,
};

const pitch = {
  fontFamily: font.displaySoft,
  fontSize: 18,
  lineHeight: 23,
  color: colors.ink,
};

const benefit = {
  fontFamily: font.body,
  fontSize: 14,
  lineHeight: 20,
  color: colors.muted,
};

const cta: ViewStyle = {
  minHeight: 48,
  borderRadius: 999,
  backgroundColor: colors.red,
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 16,
};

const ctaText = {
  fontFamily: font.bold,
  fontSize: 16,
  lineHeight: 20,
  color: colors.white,
};
