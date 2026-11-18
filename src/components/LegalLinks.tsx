import { Link } from "expo-router";
import { View } from "react-native";
import { colors, font } from "./theme";

const link = {
  fontFamily: font.medium,
  fontSize: 13,
  lineHeight: 18,
  color: colors.muted,
  textDecorationLine: "underline" as const,
};

export function LegalLinks() {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 14, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
      <Link href="/privacidad" style={link}>
        Política de privacidad
      </Link>
      <Link href="/terminos" style={link}>
        Términos y condiciones
      </Link>
    </View>
  );
}
