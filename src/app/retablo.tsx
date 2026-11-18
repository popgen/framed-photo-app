import { useState } from "react";
import { Linking, Platform, Pressable, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useReducedMotion } from "../components/fx";
import { Button, Card, Screen } from "../components/ui";
import { colors, font } from "../components/theme";
import { getRepo } from "../lib/repo";
import { inquiryFromSize, retabloMailUrl, retabloOffer } from "../lib/retablo";

export default function Retablo() {
  const reduced = useReducedMotion();
  const [size, setSize] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit() {
    try {
      inquiryFromSize(size);
      await getRepo().createRetabloInquiry(size);
      const url = retabloMailUrl(size);
      if (Platform.OS === "web") window.location.href = url;
      else await Linking.openURL(url);
      setSent(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar la consulta.");
    }
  }

  return (
    <Screen>
      <View style={{ padding: 16, gap: 14 }}>
        <Animated.View entering={reduced ? undefined : FadeInDown.springify().damping(14)}>
          <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>{retabloOffer.title}</Text>
        </Animated.View>
        <Card>
          <Text style={{ fontFamily: font.body, color: colors.ink }}>{retabloOffer.body}</Text>
        </Card>
        <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{retabloOffer.question}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {retabloOffer.suggestions.map((item) => (
            <Pressable key={item} onPress={() => setSize(item)} style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: size === item ? colors.ink : colors.white }}>
              <Text style={{ fontFamily: font.semibold, color: size === item ? "white" : colors.ink }}>{item}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput value={size} onChangeText={setSize} placeholder="El tamaño que imaginas" placeholderTextColor="#A89488" style={{ minHeight: 48, borderRadius: 12, backgroundColor: colors.white, paddingHorizontal: 12, fontFamily: font.body }} />
        {error ? <Text style={{ fontFamily: font.body, color: colors.bad }}>{error}</Text> : null}
        {sent ? <Text style={{ fontFamily: font.medium, color: colors.pine }}>Listo. El correo lleva tu tamaño a pedidos@mifotito.com.</Text> : null}
        <Button label="Enviar por correo" onPress={() => void submit()} />
      </View>
    </Screen>
  );
}
