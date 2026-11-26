import { Fraunces_600SemiBold, Fraunces_700Bold, useFonts } from "@expo-google-fonts/fraunces";
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from "@expo-google-fonts/outfit";
import { AmaticSC_700Bold } from "@expo-google-fonts/amatic-sc";
import { DancingScript_600SemiBold } from "@expo-google-fonts/dancing-script";
import { GreatVibes_400Regular } from "@expo-google-fonts/great-vibes";
import { Lobster_400Regular } from "@expo-google-fonts/lobster";
import { Pacifico_400Regular } from "@expo-google-fonts/pacifico";
import { Satisfy_400Regular } from "@expo-google-fonts/satisfy";
import { Stack, usePathname, router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { PageSeo } from "../components/PageSeo";
import { AppProvider } from "../components/provider";
import { Button } from "../components/ui";
import { colors, font } from "../components/theme";
import { useReducedMotion } from "../components/fx";
import { useCart } from "../lib/store";

export default function RootLayout() {
  const path = usePathname();
  const reduced = useReducedMotion();
  const [loaded, error] = useFonts({
    Fraunces_600SemiBold,
    Fraunces_700Bold,
    Outfit_400Regular,
    Outfit_500Medium,
    Outfit_600SemiBold,
    Outfit_700Bold,
    Pacifico_400Regular,
    DancingScript_600SemiBold,
    GreatVibes_400Regular,
    Lobster_400Regular,
    Satisfy_400Regular,
    AmaticSC_700Bold,
  });
  if (!loaded && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 28, color: colors.ink }}>Mi Fotito</Text>
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <PageSeo path={path} />
      <StatusBar style="dark" />
      <AppProvider>
        <Stack screenOptions={{ headerShown: false, animation: reduced ? "none" : "slide_from_right", contentStyle: { backgroundColor: colors.bg } }} />
      </AppProvider>
    </SafeAreaProvider>
  );
}

void font;

/** Last resort so a thrown render cannot leave the whole site as a blank page. */
export function ErrorBoundary({ retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: "center", gap: 12 }}>
        <Text style={{ fontFamily: font.display, fontSize: 28, color: colors.ink, textAlign: "center" }}>Algo salió mal</Text>
        <Text style={{ fontFamily: font.body, color: colors.muted, textAlign: "center", lineHeight: 22 }}>
          Prueba de nuevo, o vacía el carrito y empieza de nuevo. Si sigue igual, escríbenos a pedidos@mifotito.com.
        </Text>
        <Button label="Reintentar" onPress={() => void retry()} />
        <Button
          label="Vaciar carrito y empezar de nuevo"
          onPress={() => {
            useCart.getState().clear();
            router.replace("/");
          }}
        />
      </View>
    </SafeAreaProvider>
  );
}
