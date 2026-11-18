import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useApp } from "../../components/provider";
import { colors, font } from "../../components/theme";
import { siteUrl, supportNumber } from "../../lib/env";
import { samplePhoto } from "../../lib/photos";
import { getRepo } from "../../lib/repo";
import { frames } from "../../lib/catalog";
import { emptySession, reduceWa } from "../../lib/whatsapp/flow.mjs";
import type { WaDraft } from "../../lib/types";

type Reply = { kind: string; body: string; buttons?: { id: string; title: string }[]; rows?: { id: string; title: string }[] };
type Session = ReturnType<typeof emptySession>;

const catalog = frames.map((frame) => ({
  id: frame.id,
  name: frame.name,
  priceCents: frame.priceCents,
  sizeLabel: frame.sizeLabel,
  printWcm: frame.printWcm,
  printHcm: frame.printHcm,
}));

export default function WhatsAppSandbox() {
  const { refresh } = useApp();
  const [session, setSession] = useState<Session | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [photos, setPhotos] = useState<{ photoId: string; width: number; height: number }[]>([]);
  const [link, setLink] = useState<string | null>(null);

  function apply(nextSession: Session, nextReplies: Reply[], createOrder: boolean, photo = photos) {
    setSession(nextSession);
    setReplies((current) => [...current, ...nextReplies]);
    if (!createOrder) return;
    const draft: WaDraft = {
      token: nextSession.token,
      phone: nextSession.phone,
      step: nextSession.step,
      photos: photo,
      frameId: nextSession.frameId,
      mode: nextSession.mode,
      needsHuman: nextSession.needsHuman,
    };
    void getRepo().createWhatsAppOrder(draft).then(() => {
      setLink(`${siteUrl()}/w/${nextSession.token}`);
      refresh();
    });
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>WhatsApp</Text>
      <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Pedidos por el bot: próximamente</Text>
      <Text style={{ fontFamily: font.body, color: colors.muted }}>WhatsApp Business todavía no está conectado. El chat abre una conversación normal, sin la Cloud API.</Text>
      <Pressable onPress={() => openSupportChat()} style={button}><Text style={buttonText}>Escribir por WhatsApp</Text></Pressable>
      <Text style={{ fontFamily: font.display, fontSize: 24, color: colors.ink }}>Vista previa local</Text>
      <Pressable onPress={() => sendImage(false)} style={button}><Text style={buttonText}>Enviar foto nítida</Text></Pressable>
      <Pressable onPress={() => sendImage(true)} style={button}><Text style={buttonText}>Enviar foto chica</Text></Pressable>
      {replies.map((reply, index) => (
        <View key={`${reply.kind}-${index}`} style={{ backgroundColor: "#E7F6EE", borderRadius: 16, padding: 12, gap: 8 }}>
          <Text style={{ fontFamily: font.body, color: colors.ink }}>{reply.body}</Text>
          {(reply.buttons ?? reply.rows ?? []).map((choice) => (
            <Pressable key={choice.id} onPress={() => choose(choice.id)} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={{ fontFamily: font.semibold, color: colors.pine }}>{choice.title}</Text>
            </Pressable>
          ))}
        </View>
      ))}
      {link ? <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{link}</Text> : null}
    </ScrollView>
  );

  function openSupportChat() {
    const url = `https://wa.me/${supportNumber()}?text=${encodeURIComponent("Hola Mi Fotito, quiero armar un marco.")}`;
    if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
  }

  function sendImage(small: boolean) {
    const photo = samplePhoto(small ? "sample-small" : "sample");
    const nextPhotos = [...photos, { photoId: photo.id, width: photo.width, height: photo.height }];
    setPhotos(nextPhotos);
    const result = reduceWa(session, { type: "image", width: photo.width, height: photo.height, phone: "51987654321" }, { catalog, origin: siteUrl(), supportNumber: supportNumber() });
    apply(result.session, result.replies, result.createOrder, nextPhotos);
  }

  function choose(id: string) {
    if (!session) return;
    const result = reduceWa(session, { type: "select", id }, { catalog, origin: siteUrl(), supportNumber: supportNumber() });
    apply(result.session, result.replies, result.createOrder);
  }
}

const button = { minHeight: 48, borderRadius: 999, backgroundColor: colors.ink, alignItems: "center" as const, justifyContent: "center" as const };
const buttonText = { color: "white", fontFamily: font.bold };
