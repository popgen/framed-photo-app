import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { GiftSuccess } from "../../components/fx";
import { Button, Screen } from "../../components/ui";
import { colors, font } from "../../components/theme";
import { formatSoles } from "../../lib/money";
import { getRepo } from "../../lib/repo";
import { readReceipt } from "../../lib/store";
import type { Order } from "../../lib/types";

export default function Confirmacion() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [order, setOrder] = useState<Order | null>(readReceipt<Order>(String(token)));
  const [campaignTitle, setCampaignTitle] = useState("Tu recuerdo ya va en camino");
  const [campaignBody, setCampaignBody] = useState("Te escribimos por WhatsApp cuando avance.");

  useEffect(() => {
    void getRepo().getCampaign().then((campaign) => {
      setCampaignTitle(campaign.successTitle);
      setCampaignBody(campaign.successBody);
    });
    const cached = readReceipt<Order>(String(token));
    if (!cached) return;
    void getRepo().getOrderByToken(String(token), cached.phone).then((live) => {
      if (live) setOrder(live);
    });
  }, [token]);

  if (!order) {
    return (
      <Screen>
        <View style={{ padding: 20, gap: 12 }}>
          <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Busca tu pedido con el celular</Text>
          <Button label="Ver estado" onPress={() => router.push(`/pedido/${token}`)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ padding: 20, gap: 14 }}>
        <GiftSuccess title={campaignTitle} body={campaignBody} />
        <Text style={{ fontFamily: font.semibold, color: colors.ink, textAlign: "center" }}>{order.number} · {formatSoles(order.totalCents)}</Text>
        <Text style={{ fontFamily: font.body, color: colors.muted, textAlign: "center" }}>{order.etaLabel}. {order.christmasNote}</Text>
        {order.referralCodeIssued ? (
          <View style={{ backgroundColor: colors.white, borderRadius: 18, padding: 14 }}>
            <Text style={{ fontFamily: font.medium, color: colors.muted }}>Tu código de amigo</Text>
            <Text style={{ fontFamily: font.display, fontSize: 28, color: colors.ink }}>{order.referralCodeIssued}</Text>
            <Text style={{ fontFamily: font.body, color: colors.muted }}>Quien lo use ahorra S/ 15 y tú recibes S/ 15 de saldo.</Text>
          </View>
        ) : null}
        <Button label="Seguir el pedido" onPress={() => router.push(`/pedido/${order.publicToken}`)} />
        <Button label="Armar otro" tone="ghost" onPress={() => router.push("/crear")} />
      </View>
    </Screen>
  );
}
