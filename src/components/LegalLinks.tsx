import { Link } from "expo-router";
import { Text, View } from "react-native";
import { InlineLink } from "./InlineLink";
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
    <View style={{ alignItems: "center", gap: 6, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 }}>
      <Text style={{ fontFamily: font.body, fontSize: 13, lineHeight: 18, color: colors.muted, textAlign: "center" }}>
        Escríbenos: <InlineLink href="mailto:pedidos@mifotito.com">pedidos@mifotito.com</InlineLink>
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 14 }}>
        <Link href="/privacidad" style={link}>
          Política de privacidad
        </Link>
        <Link href="/terminos" style={link}>
          Términos y condiciones
        </Link>
      </View>
    </View>
  );
}
