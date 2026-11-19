import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { AccountAuth } from "../../components/AccountAuth";
import { GiftNoteCard } from "../../components/GiftNoteCard";
import { Banner, Button, Screen } from "../../components/ui";
import { colors, font } from "../../components/theme";
import { currentCustomer, type CustomerSession } from "../../lib/customer-auth";
import { getRepo } from "../../lib/repo";
import { STATUS_FLOW, STATUS_LABEL, type Order } from "../../lib/types";

export default function Pedido() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [account, setAccount] = useState<CustomerSession | null | undefined>(undefined);
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void currentCustomer().then(setAccount);
  }, []);

  useEffect(() => {
    if (!account) return;
    void getRepo()
      .getOrderByToken(String(token), "")
      .then((found) => {
        if (!found) setError("No encontramos ese pedido en tu cuenta.");
        else setOrder(found);
      })
      .catch((err: Error) => setError(err.message));
  }, [account, token]);

  return (
    <Screen>
      <View style={{ padding: 16, gap: 12 }}>
        {account === undefined ? <Text style={{ fontFamily: font.body, color: colors.muted }}>Un momento…</Text> : null}
        {account === null ? <AccountAuth title="Tu pedido" onReady={setAccount} /> : null}
        {error ? <Banner tone="bad" text={error} /> : null}
        {order ? (
          <>
            <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{order.number} · {STATUS_LABEL[order.status]}</Text>
            {order.channel === "whatsapp" ? <Banner tone="good" text="Te escribimos por correo sobre este pedido." /> : null}
            <Text style={{ fontFamily: font.body, color: colors.muted }}>{order.etaLabel}</Text>
            <Text style={{ fontFamily: font.body, color: colors.ink }}>{order.christmasNote}</Text>
            {order.giftNoteMessage ? (
              <View style={{ gap: 8 }}>
                <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Nota impresa</Text>
                <GiftNoteCard to={order.giftNoteTo} message={order.giftNoteMessage} from={order.giftNoteFrom} />
                {order.hidePrices ? <Text style={{ fontFamily: font.body, color: colors.muted }}>La caja va sin precios.</Text> : null}
              </View>
            ) : null}
            {order.trackingNumber ? <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Guía {order.trackingNumber}</Text> : null}
            <View style={{ gap: 8 }}>
              {STATUS_FLOW.map((status) => {
                const reached = STATUS_FLOW.indexOf(status) <= STATUS_FLOW.indexOf(order.status as (typeof STATUS_FLOW)[number]);
                return (
                  <Text key={status} style={{ fontFamily: font.medium, color: reached ? colors.pine : colors.muted }}>
                    {reached ? "●" : "○"} {STATUS_LABEL[status]}
                  </Text>
                );
              })}
            </View>
            <Button label="Llegó dañado" tone="ghost" onPress={() => router.push(`/reclamo?token=${order.publicToken}`)} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}
