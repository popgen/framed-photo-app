import { Fraunces_600SemiBold, Fraunces_700Bold, useFonts } from "@expo-google-fonts/fraunces";
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from "@expo-google-fonts/outfit";
import { AmaticSC_700Bold } from "@expo-google-fonts/amatic-sc";
import { DancingScript_600SemiBold } from "@expo-google-fonts/dancing-script";
import { GreatVibes_400Regular } from "@expo-google-fonts/great-vibes";
import { Lobster_400Regular } from "@expo-google-fonts/lobster";
import { Pacifico_400Regular } from "@expo-google-fonts/pacifico";
import { Satisfy_400Regular } from "@expo-google-fonts/satisfy";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Platform, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppProvider } from "../components/provider";
import { colors, font } from "../components/theme";
import { useReducedMotion } from "../components/fx";

export default function RootLayout() {
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
  useEffect(() => {
    if (Platform.OS === "web") document.title = "Mi Fotito — marcos impresos en Perú";
  }, []);
  if (!loaded && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 28, color: colors.ink }}>Mi Fotito</Text>
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <AppProvider>
        <Stack screenOptions={{ headerShown: false, animation: reduced ? "none" : "slide_from_right", contentStyle: { backgroundColor: colors.bg } }} />
      </AppProvider>
    </SafeAreaProvider>
  );
}

void font;
