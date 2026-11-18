import { createElement, useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { colors, font } from "./theme";
import { saveAudioBlob } from "../lib/photos";
import { uploadVoice } from "../lib/photo-upload";
import { VOICE_ADDON_CENTS, VOICE_MAX_BYTES, VOICE_MAX_SECONDS, newVoiceToken, publishVoice, recorderMime, type VoiceNote } from "../lib/voice";
import { formatSoles } from "../lib/money";

export function VoiceRecorder({ value, onChange }: { value: VoiceNote | null; onChange: (next: VoiceNote | null) => void }) {
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const secondsRef = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useSharedValue(1);
  const wave = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  useEffect(() => () => stopTimer(), []);

  function stopTimer() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    pulse.value = 1;
  }

  async function start() {
    if (Platform.OS !== "web" || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Graba el audio desde el navegador. En el teléfono también puedes subir un archivo.");
      return;
    }
    const mime = recorderMime();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const media = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    chunks.current = [];
    media.ondataavailable = (event) => {
      if (event.data.size) chunks.current.push(event.data);
    };
    media.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      const blob = new Blob(chunks.current, { type: media.mimeType || "audio/webm" });
      void finish(blob, secondsRef.current);
    };
    recorder.current = media;
    setSeconds(0);
    secondsRef.current = 0;
    media.start();
    pulse.value = withRepeat(withTiming(1.25, { duration: 500 }), -1, true);
    timer.current = setInterval(() => {
      setSeconds((current) => {
        const next = current + 1 >= VOICE_MAX_SECONDS ? VOICE_MAX_SECONDS : current + 1;
        secondsRef.current = next;
        if (next >= VOICE_MAX_SECONDS) {
          media.stop();
          stopTimer();
        }
        return next;
      });
    }, 1000);
  }

  function stop() {
    recorder.current?.stop();
    stopTimer();
  }

  async function finish(blob: Blob, length: number) {
    if (blob.size > VOICE_MAX_BYTES) {
      setError("El audio pasa de 8 MB.");
      return;
    }
    const saved = await saveAudioBlob(blob);
    const note: VoiceNote = {
      token: newVoiceToken(),
      audioId: saved.id,
      seconds: Math.min(VOICE_MAX_SECONDS, Math.max(1, length)),
      mime: blob.type || "audio/webm",
      addonCents: VOICE_ADDON_CENTS,
    };
    publishVoice(note);
    void uploadVoice(note.token, blob).catch(() => null);
    setPreview(URL.createObjectURL(blob));
    setError(null);
    onChange(note);
  }

  async function onFile(file: File) {
    if (file.size > VOICE_MAX_BYTES) {
      setError("El audio pasa de 8 MB.");
      return;
    }
    await finish(file, VOICE_MAX_SECONDS);
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Mensaje de voz con QR · {formatSoles(VOICE_ADDON_CENTS)}</Text>
      <Text style={{ fontFamily: font.body, color: colors.muted }}>Hasta {VOICE_MAX_SECONDS} segundos. Lo escuchan al escanear el QR del marco.</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Animated.View style={[{ width: 72, height: 72, borderRadius: 36, backgroundColor: colors.red, alignItems: "center", justifyContent: "center" }, wave]}>
          <Pressable onPress={() => (recorder.current?.state === "recording" ? stop() : void start())} style={{ width: 72, height: 72, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "white", fontFamily: font.bold }}>{recorder.current?.state === "recording" ? "Listo" : "Grabar"}</Text>
          </Pressable>
        </Animated.View>
        <Text style={{ fontFamily: font.displaySoft, fontSize: 28, color: colors.ink }}>{seconds}s</Text>
      </View>
      {Platform.OS === "web"
        ? createElement("input", {
            type: "file",
            accept: "audio/mpeg,audio/mp4,audio/wav,audio/webm,audio/x-m4a,.mp3,.m4a,.wav,.webm",
            onChange: (event: Event) => {
              const file = (event.target as HTMLInputElement).files?.[0];
              if (file) void onFile(file);
            },
          })
        : null}
      {preview && value ? createElement("audio", { src: preview, controls: true, style: { width: "100%" } }) : null}
      {value ? (
        <Pressable onPress={() => onChange(null)} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ fontFamily: font.semibold, color: colors.bad }}>Quitar audio</Text>
        </Pressable>
      ) : null}
      {error ? <Text style={{ fontFamily: font.body, color: colors.bad }}>{error}</Text> : null}
    </View>
  );
}
