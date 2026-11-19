import { useLocalSearchParams } from "expo-router";
import { createElement, useEffect, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { Screen } from "../../components/ui";
import { colors, font } from "../../components/theme";
import { resolvePhoto } from "../../lib/photos";
import { readVoice } from "../../lib/voice";

export default function VoicePage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const key = String(token || "");
  const note = readVoice(key);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [uri, setUri] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [sender, setSender] = useState<string | null>(note?.senderName ?? null);
  const [playing, setPlaying] = useState(false);
  const scale = useSharedValue(1);
  const portrait = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  useEffect(() => {
    scale.value = withRepeat(withTiming(1.04, { duration: 1600 }), -1, true);
  }, [scale]);

  useEffect(() => {
    let live = true;
    async function load() {
      if (note?.selfieId) {
        const photo = await resolvePhoto(note.selfieId);
        if (live && photo?.uri) setSelfie(photo.uri);
      }
      if (note?.audioId) {
        const photo = await resolvePhoto(note.audioId);
        if (live && photo?.uri) {
          setUri(photo.uri);
          return;
        }
      }
      const response = await fetch(`/api/shop?op=voice-url&token=${encodeURIComponent(key)}`).catch(() => null);
      const json = response ? await response.json().catch(() => null) : null;
      if (!live || !json) return;
      if (json.url) setUri(json.url);
      if (json.selfieUrl) setSelfie(json.selfieUrl);
      if (json.senderName) setSender(json.senderName);
    }
    void load();
    return () => {
      live = false;
    };
  }, [key, note?.audioId, note?.selfieId]);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play();
    else audio.pause();
  }

  return (
    <Screen>
      <View style={{ flex: 1, padding: 24, gap: 18, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontFamily: "Pacifico_400Regular", fontSize: 40, color: colors.ink }}>Mi Fotito</Text>
        <View style={{ width: "100%", backgroundColor: colors.white, borderRadius: 24, padding: 20, gap: 14, alignItems: "center" }}>
          {selfie ? (
            <Animated.View style={portrait}>
              {createElement("img", {
                src: selfie,
                alt: sender ? `Selfie de ${sender}` : "Selfie",
                style: { width: 168, height: 168, borderRadius: 84, objectFit: "cover", border: "4px solid #F6EFE6" },
              })}
            </Animated.View>
          ) : null}
          <Text style={{ fontFamily: font.displaySoft, fontSize: 28, color: colors.ink, textAlign: "center" }}>
            {sender ? `${sender} te dejó una voz` : "Un mensaje para ti"}
          </Text>
          <Text style={{ fontFamily: font.body, color: colors.muted, textAlign: "center" }}>
            {note ? `${note.seconds} segundos` : "Alguien te dejó una voz con su marco."}
          </Text>
          {uri ? (
            <>
              <Pressable onPress={toggle} style={{ width: 84, height: 84, borderRadius: 42, backgroundColor: colors.red, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "white", fontFamily: font.bold, fontSize: 16 }}>{playing ? "Pausa" : "Escuchar"}</Text>
              </Pressable>
              {createElement("audio", {
                ref: (node: HTMLAudioElement) => { audioRef.current = node; },
                src: uri,
                style: { width: "100%" },
                controls: true,
                onPlay: () => setPlaying(true),
                onPause: () => setPlaying(false),
              }, createElement("source", { src: uri, type: note?.mime || "audio/mp4" }))}
            </>
          ) : <Text style={{ fontFamily: font.body, color: colors.muted, textAlign: "center" }}>Este mensaje no está en este navegador.</Text>}
        </View>
      </View>
    </Screen>
  );
}
