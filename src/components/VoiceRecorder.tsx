import { Image } from "expo-image";
import { createElement, useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { colors, font } from "./theme";
import { Collapsible } from "./Collapsible";
import Svg, { Path } from "react-native-svg";
import { SelfieField } from "./SelfieField";
import { saveAudioBlob, resolvePhoto } from "../lib/photos";
import { attachVoiceSelfie, uploadSelfie, uploadVoice } from "../lib/photo-upload";
import { VOICE_ADDON_CENTS, VOICE_MAX_BYTES, VOICE_MAX_SECONDS, newVoiceToken, publishVoice, recorderMime, type VoiceNote } from "../lib/voice";
import { formatSoles } from "../lib/money";
import { voiceQrDataUrl } from "../lib/voice-qr";

export function VoiceRecorder({ value, onChange }: { value: VoiceNote | null; onChange: (next: VoiceNote | null) => void }) {
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [name, setName] = useState(value?.senderName ?? "");
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const selfieRef = useRef<{ id: string; path: string | null } | null>(value?.selfieId ? { id: value.selfieId, path: value.selfiePath ?? null } : null);
  const chunks = useRef<Blob[]>([]);
  const secondsRef = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = useSharedValue(1);
  const wave = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  useEffect(() => () => stopTimer(), []);
  useEffect(() => {
    let live = true;
    if (!value?.selfieId) {
      if (!selfieRef.current) setSelfieUrl(null);
      return;
    }
    void resolvePhoto(value.selfieId).then((photo) => {
      if (live) setSelfieUrl(photo?.uri ?? null);
    });
    return () => {
      live = false;
    };
  }, [value?.selfieId]);

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
    setRecording(true);
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
    setRecording(false);
    recorder.current?.stop();
    stopTimer();
  }

  async function finish(blob: Blob, length: number) {
    if (blob.size > VOICE_MAX_BYTES) {
      setError("El audio pasa de 8 MB.");
      return;
    }
    const saved = await saveAudioBlob(blob);
    const selfie = selfieRef.current;
    const note: VoiceNote = {
      token: newVoiceToken(),
      audioId: saved.id,
      seconds: Math.min(VOICE_MAX_SECONDS, Math.max(1, length)),
      mime: blob.type || "audio/webm",
      addonCents: VOICE_ADDON_CENTS,
      selfieId: selfie?.id ?? null,
      selfiePath: selfie?.path ?? null,
      senderName: name.trim() || null,
    };
    publishVoice(note);
    void uploadVoice(note.token, blob, { selfiePath: note.selfiePath, senderName: note.senderName }).catch(() => null);
    setPreview(URL.createObjectURL(blob));
    setQr(await voiceQrDataUrl(note.token));
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
    <Collapsible
      title="Agrega un mensaje de voz con QR"
      icon={<MicIcon />}
      extra={VOICE_ADDON_CENTS > 0 ? <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{formatSoles(VOICE_ADDON_CENTS)}</Text> : null}
      badge={value ? "Mensaje grabado" : null}
    >
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Mensaje de voz con QR · {formatSoles(VOICE_ADDON_CENTS)}</Text>
      <Text style={{ fontFamily: font.body, color: colors.muted }}>Hasta {VOICE_MAX_SECONDS} segundos. Lo escuchan al escanear el QR del marco.</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
        <Animated.View style={[{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.red, alignItems: "center", justifyContent: "center" }, wave]}>
          <Pressable onPress={() => (recording ? stop() : void start())} style={{ width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ color: "white", fontFamily: font.bold, fontSize: 16 }}>{recording ? "Listo" : "Grabar"}</Text>
          </Pressable>
        </Animated.View>
        <Text style={{ fontFamily: font.displaySoft, fontSize: 28, color: colors.ink }}>{seconds}s</Text>
      </View>
      {Platform.OS === "web" ? (
        <Pressable onPress={() => fileRef.current?.click()} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Subir un audio</Text>
        </Pressable>
      ) : null}
      {Platform.OS === "web"
        ? createElement("input", {
            ref: (node: HTMLInputElement) => { fileRef.current = node; },
            type: "file",
            accept: "audio/mpeg,audio/mp4,audio/wav,audio/webm,audio/x-m4a,.mp3,.m4a,.wav,.webm",
            style: { display: "none" },
            onChange: (event: Event) => {
              const file = (event.target as HTMLInputElement).files?.[0];
              if (file) void onFile(file);
            },
          })
        : null}
      {preview && value ? createElement("audio", { src: preview, controls: true, style: { width: "100%" } }) : null}
      {qr && value ? (
        <View style={{ alignItems: "center", gap: 6, backgroundColor: colors.white, borderRadius: 16, padding: 12 }}>
          <Image source={{ uri: qr }} style={{ width: 160, height: 160 }} />
          <Text style={{ fontFamily: font.medium, color: colors.ink, textAlign: "center" }}>Escanea y escucha</Text>
          <Text style={{ fontFamily: font.body, color: colors.muted, textAlign: "center" }}>https://mifotito.com/v/{value.token}</Text>
        </View>
      ) : null}
      {value ? (
        <Pressable onPress={() => { setPreview(null); setQr(null); onChange(null); }} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ fontFamily: font.semibold, color: colors.bad }}>Quitar audio</Text>
        </Pressable>
      ) : null}
      <SelfieField
        savedUrl={selfieUrl}
        senderName={name}
        onSenderName={(next) => {
          setName(next);
          if (!value) return;
          const updated = { ...value, senderName: next.trim() || null };
          publishVoice(updated);
          onChange(updated);
          if (updated.selfiePath) void attachVoiceSelfie(value.token, updated.selfiePath, next);
        }}
        onUse={async (blob) => {
          const saved = await saveAudioBlob(blob);
          const path = await uploadSelfie(blob).catch(() => null);
          selfieRef.current = { id: saved.id, path };
          setSelfieUrl(URL.createObjectURL(blob));
          if (!value) return;
          const updated = { ...value, selfieId: saved.id, selfiePath: path, senderName: name.trim() || null };
          publishVoice(updated);
          if (path) await attachVoiceSelfie(value.token, path, name);
          onChange(updated);
        }}
        onRemove={() => {
          selfieRef.current = null;
          setSelfieUrl(null);
          if (!value) return;
          const updated = { ...value, selfieId: null, selfiePath: null };
          publishVoice(updated);
          void attachVoiceSelfie(value.token, null, name);
          onChange(updated);
        }}
      />
      {error ? <Text style={{ fontFamily: font.body, color: colors.bad }}>{error}</Text> : null}
    </View>
    </Collapsible>
  );
}

function MicIcon() {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z" fill="none" stroke={colors.ink} strokeWidth={1.8} />
      <Path d="M6 11a6 6 0 0 0 12 0M12 17v3" fill="none" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
