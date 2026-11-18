import { Fraunces_600SemiBold, Fraunces_700Bold, useFonts } from "@expo-google-fonts/fraunces";
import { Outfit_400Regular, Outfit_500Medium, Outfit_600SemiBold, Outfit_700Bold } from "@expo-google-fonts/outfit";
import { Pacifico_400Regular } from "@expo-google-fonts/pacifico";
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
