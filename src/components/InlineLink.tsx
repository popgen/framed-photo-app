import { Link } from "expo-router";
import { Platform, Text } from "react-native";
import { colors, font } from "./theme";

const style = { color: colors.redDark, fontFamily: font.semibold, textDecorationLine: "underline" as const };

export function InlineLink({ href, children }: { href: string; children: string }) {
  if (href.startsWith("/")) {
    return (
      <Link href={href as "/privacidad"} style={style}>
        {children}
      </Link>
    );
  }
  return (
    <Text
      accessibilityRole="link"
      style={style}
      onPress={() => {
        if (Platform.OS === "web") window.location.href = href;
      }}
    >
      {children}
    </Text>
  );
}
