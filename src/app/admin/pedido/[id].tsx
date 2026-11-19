import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useApp, useRepo } from "../../../components/provider";
import { BackButton, Banner } from "../../../components/ui";
import { colors, font } from "../../../components/theme";
import { GiftNoteCard } from "../../../components/GiftNoteCard";
import { cardOrderLine, envelopeLabel } from "../../../lib/cards";
import { openGiftNotePrint } from "../../../lib/gift-note";
import { frameById } from "../../../lib/catalog";
import { downloadCardPdf, downloadPrint } from "../../../lib/print-export";
import { getRepo } from "../../../lib/repo";
import { STATUS_FLOW, STATUS_LABEL, type OrderStatus } from "../../../lib/types";

export default function AdminOrder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { refresh } = useApp();
  const { data: order } = useRepo((repo) => repo.getOrder(String(id)), [id]);
  const { data: notes } = useRepo((repo) => repo.listNotifications(String(id)), [id, order?.updatedAt]);
  const [tracking, setTracking] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!order) {
    return (
      <View style={{ padding: 16 }}>
        <BackButton fallback="/admin" />
        <Text style={{ fontFamily: font.body }}>Cargando…</Text>
      </View>
    );
  }

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      setError(null);
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar.");
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <BackButton fallback="/admin" />
      <Text style={{ fontFamily: font.display, fontSize: 30, color: colors.ink }}>{order.number}</Text>
      <Text style={{ fontFamily: font.body, color: colors.muted }}>
        {order.customerName} · {order.phone} · {order.channel === "whatsapp" ? "WhatsApp" : "Web"}
      </Text>
      <Text style={{ fontFamily: font.body, color: colors.ink }}>{order.addressLine}, {order.district}, {order.province}, {order.department}</Text>
      <Text style={{ fontFamily: font.body, color: colors.ink }}>{order.taxIdSkipped || !order.taxId ? "Sin DNI/RUC" : `${order.taxIdType} ${order.taxId}`}</Text>
      <Text style={{ fontFamily: font.body, color: colors.muted }}>{order.phone} · {order.email}</Text>
      <Text style={{ fontFamily: font.body, color: colors.muted }}>{order.christmasNote}</Text>
      {order.isGift ? <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Regalo</Text> : null}
      {order.giftNoteMessage ? (
        <View style={{ gap: 8 }}>
          <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Nota impresa</Text>
          <GiftNoteCard to={order.giftNoteTo} message={order.giftNoteMessage} from={order.giftNoteFrom} />
          {order.hidePrices ? <Text style={{ fontFamily: font.body, color: colors.ink }}>No incluir precios en la caja.</Text> : null}
          <Pressable onPress={() => router.push(`/admin/nota/${order.id}`)} style={chip(false)}>
            <Text style={chipText(false)}>Ver nota</Text>
          </Pressable>
          <Pressable onPress={() => openGiftNotePrint({ to: order.giftNoteTo, message: order.giftNoteMessage || "", from: order.giftNoteFrom, isGift: order.isGift })} style={chip(true)}>
            <Text style={chipText(true)}>Imprimir nota</Text>
          </Pressable>
        </View>
      ) : null}
      {error ? <Banner tone="bad" text={error} /> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {STATUS_FLOW.map((status) => (
          <Pressable key={status} onPress={() => void run(() => getRepo().setStatus(order.id, status as OrderStatus))} style={chip(order.status === status)}>
            <Text style={chipText(order.status === status)}>{STATUS_LABEL[status]}</Text>
          </Pressable>
        ))}
      </View>
      {order.items.map((item) => (
        <View key={item.id} style={{ backgroundColor: colors.white, borderRadius: 16, padding: 12, gap: 8 }}>
          <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{item.card ? `Tarjeta ${item.card.sizeId}` : `${frameById(item.frameId).name} · ${item.dpi} dpi`}</Text>
          {item.textOverlay?.text ? <Text style={{ fontFamily: font.body, color: colors.ink }}>Texto: {item.textOverlay.text}</Text> : null}
          {item.card ? <Text style={{ fontFamily: font.body, color: colors.ink }}>{cardOrderLine(item.card)}</Text> : null}
          {item.card ? <Text style={{ fontFamily: font.body, color: colors.ink }}>Portada: {item.card.frontMessage?.text || "Sin texto"}{item.card.photos.front ? " · con foto" : ""}</Text> : null}
          {item.card ? <Text style={{ fontFamily: font.body, color: colors.ink }}>Interior: {item.card.insideMessage?.text || "Sin texto"}{item.card.photos.insideCenter ? " · con foto" : ""}</Text> : null}
          {item.card ? <Text style={{ fontFamily: font.body, color: colors.muted }}>Reverso fijo: Mi Fotito</Text> : null}
          {item.card ? <Text style={{ fontFamily: font.body, color: colors.ink }}>{envelopeLabel(item.card.envelopeColor)}</Text> : null}
          {item.card?.sizeId === "5x7" ? <Text style={{ fontFamily: font.semibold, color: colors.bad }}>Se imprime en un taller, con cartulina grande.</Text> : null}
          {item.voice ? (
            <View style={{ gap: 6 }}>
              <Text style={{ fontFamily: font.body, color: colors.ink }}>Voz {item.voice.seconds}s</Text>
              <Pressable onPress={() => void downloadVoiceCard(item.voice!.token, "png")} style={chip(false)}>
                <Text style={chipText(false)}>Descargar QR (PNG)</Text>
              </Pressable>
              <Pressable onPress={() => void downloadVoiceCard(item.voice!.token, "svg")} style={chip(false)}>
                <Text style={chipText(false)}>Descargar QR (SVG)</Text>
              </Pressable>
            </View>
          ) : null}
          {item.photoPrintPath ? (
            <Pressable onPress={() => void getRepo().signPhoto(item.photoPrintPath || "").then((url) => window.open(url, "_blank")).catch((err: Error) => setError(err.message))} style={chip(false)}>
              <Text style={chipText(false)}>Abrir foto de imprenta</Text>
            </Pressable>
          ) : null}
          {item.blurry ? <Banner tone="warn" text={item.blurryNote || "Marcada como borrosa"} /> : null}
          <Pressable onPress={() => void run(() => getRepo().flagBlurry(order.id, item.id, "La foto se ve borrosa para el tamaño elegido."))} style={chip(false)}>
            <Text style={chipText(false)}>Pedir otra foto</Text>
          </Pressable>
          {item.card ? (
            <Pressable onPress={() => void downloadCardPdf(item.card!, `${order.number}-tarjeta.pdf`).catch((err: Error) => setError(err.message))} style={chip(false)}>
              <Text style={chipText(false)}>Descargar PDF</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() =>
                void downloadPrint({
                  photoId: item.photoId,
                  crop: item.crop,
                  printWcm: frameById(item.frameId).printWcm,
                  printHcm: frameById(item.frameId).printHcm,
                  orientation: item.orientation,
                  filename: `${order.number}-${item.id}.jpg`,
                  overlay: item.textOverlay,
                }).catch((err: Error) => setError(err.message))
              }
              style={chip(false)}
            >
              <Text style={chipText(false)}>Descargar impresión</Text>
            </Pressable>
          )}
        </View>
      ))}
      <TextInput value={tracking} onChangeText={setTracking} placeholder="Número de guía" placeholderTextColor="#A89488" style={{ minHeight: 48, borderRadius: 12, backgroundColor: colors.white, paddingHorizontal: 12, fontFamily: font.body }} />
      <Pressable onPress={() => void run(() => getRepo().setTracking(order.id, tracking))} style={chip(true)}>
        <Text style={chipText(true)}>Guardar guía y avisar</Text>
      </Pressable>
      <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Mensajes</Text>
      {(notes ?? []).map((note) => (
        <Text key={note.id} style={{ fontFamily: font.body, color: colors.muted }}>{note.channel}: {note.body}</Text>
      ))}
    </ScrollView>
  );
}

async function downloadVoiceCard(token: string, kind: "png" | "svg") {
  const { voiceQrDataUrl, voiceQrSvg } = await import("../../../lib/voice-qr");
  const href = kind === "png" ? await voiceQrDataUrl(token) : URL.createObjectURL(new Blob([await voiceQrSvg(token)], { type: "image/svg+xml" }));
  const link = document.createElement("a");
  link.href = href;
  link.download = `voz-${token}.${kind}`;
  link.click();
}

function chip(on: boolean) {
  return { minHeight: 44, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center" as const, backgroundColor: on ? colors.ink : colors.white };
}
function chipText(on: boolean) {
  return { fontFamily: font.semibold, color: on ? "white" : colors.ink };
}
