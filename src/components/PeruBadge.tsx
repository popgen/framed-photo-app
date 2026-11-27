import { Text, View } from "react-native";
import { colors, font } from "./theme";

export const PERU_BADGE_TEXT = "Producto 100% Peruano";

/** Small one-line badge: red-white-red flag stripes and the text. */
export function PeruBadge() {
  return (
    <View testID="producto-peruano" accessibilityRole="text" accessibilityLabel={PERU_BADGE_TEXT} style={{ alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 8, minHeight: 30, paddingHorizontal: 12, borderRadius: 999, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line }}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={{ flexDirection: "row", width: 18, height: 12, borderRadius: 2, overflow: "hidden", borderWidth: 0.5, borderColor: colors.line }}>
        <View style={{ flex: 1, backgroundColor: "#D91023" }} />
        <View style={{ flex: 1, backgroundColor: "#FFFFFF" }} />
        <View style={{ flex: 1, backgroundColor: "#D91023" }} />
      </View>
      <Text numberOfLines={1} style={{ fontFamily: font.semibold, fontSize: 13, color: colors.redDark }}>{PERU_BADGE_TEXT}</Text>
    </View>
  );
}
