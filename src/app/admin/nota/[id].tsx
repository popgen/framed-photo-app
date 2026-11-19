import { useLocalSearchParams } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { GiftNoteCard } from "../../../components/GiftNoteCard";
import { useRepo } from "../../../components/provider";
import { BackButton } from "../../../components/ui";
import { colors, font } from "../../../components/theme";
import { openGiftNotePrint } from "../../../lib/gift-note";

export default function PrintableGiftNote() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: order } = useRepo((repo) => repo.getOrder(String(id)), [id]);
  if (!order?.giftNoteMessage) {
    return (
      <View style={{ padding: 16, gap: 12 }}>
        <BackButton fallback="/admin" />
        <Text style={{ fontFamily: font.body, color: colors.ink }}>Este pedido no tiene nota impresa.</Text>
      </View>
    );
  }
  return (
    <View style={{ padding: 16, gap: 16, backgroundColor: "#EFE6DC", minHeight: "100%" }}>
      <BackButton fallback={`/admin/pedido/${order.id}`} />
      <Text style={{ fontFamily: font.display, fontSize: 28, color: colors.ink }}>Nota de {order.number}</Text>
      <Text style={{ fontFamily: font.body, color: colors.muted }}>Tarjeta A6, 10,5 × 14,8 cm. Corta por la línea punteada.</Text>
      {order.hidePrices ? <Text style={{ fontFamily: font.semibold, color: colors.ink }}>No incluir precios en la caja.</Text> : null}
      <GiftNoteCard to={order.giftNoteTo} message={order.giftNoteMessage} from={order.giftNoteFrom} />
      <Pressable
        onPress={() => openGiftNotePrint({ to: order.giftNoteTo, message: order.giftNoteMessage || "", from: order.giftNoteFrom })}
        style={{ minHeight: 52, borderRadius: 16, backgroundColor: colors.ink, alignItems: "center", justifyContent: "center" }}
      >
        <Text style={{ fontFamily: font.semibold, color: "white" }}>Imprimir nota</Text>
      </Pressable>
    </View>
  );
}
