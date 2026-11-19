import { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Honeypot } from "../components/Honeypot";
import { useReducedMotion } from "../components/fx";
import { Button, Card, Screen } from "../components/ui";
import { colors, font } from "../components/theme";
import { CONTACT_SUCCESS, HONEYPOT_FIELD } from "../lib/contact";
import { getRepo } from "../lib/repo";
import { inquiryFromSize, retabloOffer } from "../lib/retablo";
import { useContactSend } from "../lib/use-contact";

export default function Retablo() {
  const reduced = useReducedMotion();
  const [size, setSize] = useState("");
  const [honey, setHoney] = useState("");
  const { busy, sent, error, setError, send } = useContactSend();

  async function submit() {
    if (busy || sent) return;
    try {
      inquiryFromSize(size);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Cuéntanos el tamaño en una frase.");
      return;
    }
    const trimmed = size.trim();
    await send(
      { type: "retablo", size: trimmed, [HONEYPOT_FIELD]: honey },
      {
        after: async () => {
          await getRepo().createRetabloInquiry(trimmed);
        },
      },
    );
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
        <TextInput value={size} onChangeText={setSize} placeholder="El tamaño que imaginas" placeholderTextColor="#A89488" style={{ minHeight: 48, borderRadius: 12, backgroundColor: colors.white, paddingHorizontal: 12, fontFamily: font.body, fontSize: 16 }} />
        <Honeypot value={honey} onChangeText={setHoney} />
        {error ? <Text style={{ fontFamily: font.body, color: colors.bad }}>{error}</Text> : null}
        {sent ? <Text style={{ fontFamily: font.medium, color: colors.pine }}>{CONTACT_SUCCESS}</Text> : null}
        <Button label={busy ? "Enviando…" : "Enviar por correo"} disabled={busy || sent} onPress={() => void submit()} />
      </View>
    </Screen>
  );
}
