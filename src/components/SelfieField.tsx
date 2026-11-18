import { createElement, useEffect, useRef, useState } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { colors, font } from "./theme";
import { encodeSelfie } from "../lib/selfie";

type Draft = { url: string; blob: Blob };

export function SelfieField({
  savedUrl,
  senderName,
  onSenderName,
  onUse,
  onRemove,
}: {
  savedUrl: string | null;
  senderName: string;
  onSenderName: (name: string) => void;
  onUse: (blob: Blob) => Promise<void>;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [camera, setCamera] = useState(false);
  const [fallback, setFallback] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cameraInput = useRef<HTMLInputElement | null>(null);
  const fileInput = useRef<HTMLInputElement | null>(null);
  const bob = useSharedValue(0);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));

  useEffect(() => {
    bob.value = withRepeat(withTiming(-6, { duration: 900 }), -1, true);
  }, [bob]);

  async function acceptFile(file: File) {
    setError(null);
    setBusy(true);
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" } as ImageBitmapOptions);
      try {
        const blob = await encodeSelfie(bitmap, bitmap.width, bitmap.height);
        if (draft) URL.revokeObjectURL(draft.url);
        setDraft({ url: URL.createObjectURL(blob), blob });
        setCamera(false);
      } finally {
        bitmap.close();
      }
    } catch {
      setError("No pudimos leer esa foto. Prueba con otra.");
    } finally {
      setBusy(false);
    }
  }

  function openCamera() {
    const media = typeof navigator !== "undefined" ? navigator.mediaDevices?.getUserMedia : undefined;
    if (Platform.OS === "web" && media) {
      setFallback(false);
      setCamera(true);
      return;
    }
    setFallback(true);
    cameraInput.current?.click();
  }

  return (
    <View style={{ gap: 10, marginTop: 8 }}>
      <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Agrega tu selfie</Text>
      <Text style={{ fontFamily: font.body, color: colors.muted }}>Opcional. Quien escanee el QR te ve en un círculo, junto a tu voz.</Text>
      <TextInput
        value={senderName}
        onChangeText={onSenderName}
        placeholder="Tu nombre (opcional)"
        placeholderTextColor="#A89488"
        maxLength={40}
        style={{ minHeight: 48, borderRadius: 14, backgroundColor: colors.white, paddingHorizontal: 12, fontFamily: font.body, color: colors.ink }}
      />
      {camera ? (
        <LiveCamera
          onClose={() => setCamera(false)}
          onCapture={(blob) => {
            if (draft) URL.revokeObjectURL(draft.url);
            setDraft({ url: URL.createObjectURL(blob), blob });
            setCamera(false);
          }}
          onFallback={() => {
            setCamera(false);
            setFallback(true);
            cameraInput.current?.click();
          }}
        />
      ) : null}
      {draft ? (
        <Animated.View entering={FadeIn.duration(280)} style={[{ alignItems: "center", gap: 10 }, float]}>
          {createElement("img", { src: draft.url, alt: "Tu selfie", style: { width: 180, height: 180, borderRadius: 90, objectFit: "cover", border: "4px solid #fff", boxShadow: "0 10px 24px rgba(36,23,20,0.18)" } })}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              disabled={busy}
              onPress={() => {
                setBusy(true);
                void onUse(draft.blob).then(() => {
                  URL.revokeObjectURL(draft.url);
                  setDraft(null);
                }).finally(() => setBusy(false));
              }}
              style={pill(colors.ink)}
            >
              <Text style={{ color: "white", fontFamily: font.bold }}>{busy ? "Guardando…" : "Usar esta foto"}</Text>
            </Pressable>
            <Pressable onPress={() => { URL.revokeObjectURL(draft.url); setDraft(null); }} style={pill(colors.white)}>
              <Text style={{ color: colors.ink, fontFamily: font.bold }}>Repetir</Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}
      {savedUrl && !draft ? (
        <Animated.View entering={FadeIn} style={{ alignItems: "center", gap: 8 }}>
          {createElement("img", { src: savedUrl, alt: "Selfie elegida", style: { width: 120, height: 120, borderRadius: 60, objectFit: "cover", border: "4px solid #fff" } })}
          <Pressable onPress={onRemove} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ fontFamily: font.semibold, color: colors.bad }}>Quitar selfie</Text>
          </Pressable>
        </Animated.View>
      ) : null}
      {!camera && !draft ? (
        <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
          <Pressable onPress={openCamera} style={pill(colors.red)}>
            <Text style={{ color: "white", fontFamily: font.bold }}>Tomar selfie</Text>
          </Pressable>
          <Pressable onPress={() => fileInput.current?.click()} style={pill(colors.white)}>
            <Text style={{ color: colors.ink, fontFamily: font.bold }}>Subir una foto</Text>
          </Pressable>
        </View>
      ) : null}
      {Platform.OS === "web"
        ? createElement("input", {
            ref: (node: HTMLInputElement) => { cameraInput.current = node; },
            type: "file",
            accept: "image/*",
            capture: "user",
            hidden: true,
            onChange: (event: Event) => {
              const file = (event.target as HTMLInputElement).files?.[0];
              if (file) void acceptFile(file);
            },
          })
        : null}
      {Platform.OS === "web"
        ? createElement("input", {
            ref: (node: HTMLInputElement) => { fileInput.current = node; },
            type: "file",
            accept: "image/*",
            hidden: true,
            onChange: (event: Event) => {
              const file = (event.target as HTMLInputElement).files?.[0];
              if (file) void acceptFile(file);
            },
          })
        : null}
      {fallback ? <Text style={{ fontFamily: font.body, color: colors.muted }}>Tu navegador abre la cámara del teléfono.</Text> : null}
      {error ? <Text style={{ fontFamily: font.body, color: colors.bad }}>{error}</Text> : null}
    </View>
  );
}

function LiveCamera({ onCapture, onClose, onFallback }: { onCapture: (blob: Blob) => void; onClose: () => void; onFallback: () => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const fallbackRef = useRef(onFallback);
  fallbackRef.current = onFallback;

  useEffect(() => {
    let gone = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false }).then((stream) => {
      if (gone) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        void videoRef.current.play();
      }
    }).catch(() => fallbackRef.current());
    return () => {
      gone = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const blob = await encodeSelfie(video, video.videoWidth, video.videoHeight);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    onCapture(blob);
  }

  return (
    <View style={{ alignItems: "center", gap: 10 }}>
      {createElement("video", {
        ref: (node: HTMLVideoElement) => { videoRef.current = node; },
        autoPlay: true,
        muted: true,
        playsInline: true,
        style: { width: 240, height: 240, borderRadius: 120, objectFit: "cover", transform: "scaleX(-1)", background: "#241714" },
      })}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable onPress={() => void capture()} style={pill(colors.red)}>
          <Text style={{ color: "white", fontFamily: font.bold }}>Capturar</Text>
        </Pressable>
        <Pressable onPress={onClose} style={pill(colors.white)}>
          <Text style={{ color: colors.ink, fontFamily: font.bold }}>Cancelar</Text>
        </Pressable>
      </View>
    </View>
  );
}

function pill(background: string) {
  return { minHeight: 48, paddingHorizontal: 16, borderRadius: 999, backgroundColor: background, alignItems: "center" as const, justifyContent: "center" as const, borderWidth: background === colors.white ? 1 : 0, borderColor: colors.line };
}
