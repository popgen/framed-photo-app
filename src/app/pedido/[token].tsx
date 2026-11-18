import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Banner, Button, Field, Screen } from "../../components/ui";
import { colors, font } from "../../components/theme";
import { getRepo } from "../../lib/repo";
import { STATUS_FLOW, STATUS_LABEL, type Order } from "../../lib/types";

export default function Pedido() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Tu pedido</Text>
        {!order ? (
          <>
            <Text style={{ fontFamily: font.body, color: colors.muted }}>Escribe el celular del pedido para ver el estado.</Text>
            <Field label="Celular" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
            {error ? <Banner tone="bad" text={error} /> : null}
            <Button
              label="Ver estado"
              onPress={() => {
                void getRepo()
                  .getOrderByToken(String(token), phone)
                  .then((found) => {
                    if (!found) setError("No coincide el pedido con ese celular.");
                    else {
                      setError(null);
                      setOrder(found);
                    }
                  });
              }}
            />
          </>
        ) : (
          <>
            <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{order.number} · {STATUS_LABEL[order.status]}</Text>
            {order.channel === "whatsapp" ? <Banner tone="good" text="Pedido que empezó por WhatsApp." /> : null}
            <Text style={{ fontFamily: font.body, color: colors.muted }}>{order.etaLabel}</Text>
            <Text style={{ fontFamily: font.body, color: colors.ink }}>{order.christmasNote}</Text>
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
        )}
      </View>
    </Screen>
  );
}
