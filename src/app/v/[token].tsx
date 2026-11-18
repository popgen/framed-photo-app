import { useLocalSearchParams } from "expo-router";
import { createElement, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Screen } from "../../components/ui";
import { colors, font } from "../../components/theme";
import { resolvePhoto } from "../../lib/photos";
import { readVoice } from "../../lib/voice";

export default function VoicePage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const key = String(token || "");
  const note = readVoice(key);
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    async function load() {
      if (note?.audioId) {
        const photo = await resolvePhoto(note.audioId);
        if (live && photo?.uri) {
          setUri(photo.uri);
          return;
        }
      }
      const response = await fetch(`/api/voice-url?token=${encodeURIComponent(key)}`).catch(() => null);
      const json = response ? await response.json().catch(() => null) : null;
      if (live && json?.url) setUri(json.url);
    }
    void load();
    return () => {
      live = false;
    };
  }, [key, note?.audioId]);

  return (
    <Screen>
      <View style={{ flex: 1, padding: 24, gap: 18, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Pacifico_400Regular", fontSize: 40, color: colors.ink }}>Mi Fotito</Text>
        <View style={{ width: "100%", backgroundColor: colors.white, borderRadius: 24, padding: 20, gap: 12, alignItems: "center" }}>
          <Text style={{ fontFamily: font.displaySoft, fontSize: 28, color: colors.ink, textAlign: "center" }}>Un mensaje para ti</Text>
          <Text style={{ fontFamily: font.body, color: colors.muted, textAlign: "center" }}>
            {note ? `${note.seconds} segundos` : "Alguien te dejó una voz con su marco."}
          </Text>
          {uri
            ? createElement("audio", { src: uri, controls: true, style: { width: "100%" } })
            : <Text style={{ fontFamily: font.body, color: colors.muted, textAlign: "center" }}>Este mensaje no está en este navegador.</Text>}
        </View>
      </View>
    </Screen>
  );
}
