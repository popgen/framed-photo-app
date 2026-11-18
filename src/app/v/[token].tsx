import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { createElement } from "react";
import { Text, View } from "react-native";
import { Screen } from "../../components/ui";
import { colors, font } from "../../components/theme";
import { resolvePhoto } from "../../lib/photos";
import { readVoice } from "../../lib/voice";

export default function VoicePage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const note = readVoice(String(token || ""));
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    if (!note) return;
    void resolvePhoto(note.audioId).then((photo) => setUri(photo?.uri ?? null));
  }, [note?.audioId]);
  return (
    <Screen>
      <View style={{ padding: 24, gap: 16, alignItems: "center" }}>
        <Text style={{ fontFamily: "Pacifico_400Regular", fontSize: 36, color: colors.ink }}>Mi Fotito</Text>
        <Text style={{ fontFamily: font.displaySoft, fontSize: 28, color: colors.ink, textAlign: "center" }}>Un mensaje para ti</Text>
        {note && uri ? createElement("audio", { src: uri, controls: true, autoPlay: false, style: { width: "100%" } }) : <Text style={{ fontFamily: font.body, color: colors.muted }}>Este mensaje no está en este navegador.</Text>}
      </View>
    </Screen>
  );
}
