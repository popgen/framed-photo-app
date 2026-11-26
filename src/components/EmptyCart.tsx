import { router } from "expo-router";
import { Text, View } from "react-native";
import { Button } from "./ui";
import { colors, font } from "./theme";

export const EMPTY_CART_TITLE = "Tu carrito está vacío";
export const EMPTY_CART_BODY = "Arma un marco o una tarjeta para continuar.";
export const EMPTY_CART_ACTION = "Empezar";

/** Friendly empty cart: never a blank page, a pay button, or a gift form. */
export function EmptyCart() {
  return (
    <View style={{ padding: 16, gap: 16 }}>
      <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>{EMPTY_CART_TITLE}</Text>
      <Text style={{ fontFamily: font.body, color: colors.muted, lineHeight: 22 }}>{EMPTY_CART_BODY}</Text>
      <Button label={EMPTY_CART_ACTION} onPress={() => router.push("/")} />
    </View>
  );
}
