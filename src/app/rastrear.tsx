import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, Text, View } from "react-native";
import { PhoneVerify } from "../components/PhoneVerify";
import { Button, Screen } from "../components/ui";
import { colors, font } from "../components/theme";
import { normalizePhone } from "../lib/phone";
import { getRepo } from "../lib/repo";
import { readPhoneSession } from "../lib/phone-session";
import { STATUS_FLOW, STATUS_LABEL, type OrderStatus } from "../lib/types";
import type { TrackingCard } from "../lib/tracking";

export default function Rastrear() {
  const [orders, setOrders] = useState<TrackingCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === "web") document.title = "Rastrea tu pedido";
  }, []);

  async function load(phone: string) {
    const normalized = normalizePhone(phone) || readPhoneSession()?.phone || phone;
    const rows = await getRepo().listOrdersByPhone(normalized);
    setOrders(rows);
    setError(rows.length ? null : "No hay pedidos con este celular.");
  }

  return (
    <Screen>
      <View style={{ padding: 16, gap: 14 }}>
        {orders ? (
          <>
            <Text accessibilityRole="header" style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Rastrea tu pedido</Text>
            {error ? <Text style={{ fontFamily: font.body, color: colors.muted }}>{error}</Text> : null}
            {orders.map((order) => (
              <View key={order.publicToken} style={{ backgroundColor: colors.white, borderRadius: 16, padding: 12, gap: 6 }}>
                <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{STATUS_LABEL[order.status as OrderStatus]}</Text>
                <Text style={{ fontFamily: font.body, color: colors.muted }}>{order.etaLabel}</Text>
                <Text style={{ fontFamily: font.body, color: colors.ink }}>{order.christmasNote}</Text>
                {order.trackingNumber ? <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Guía {order.trackingNumber}</Text> : null}
                <Text style={{ fontFamily: font.body, color: colors.muted }}>{order.addressMasked}</Text>
                {order.recipientPhoneMasked ? <Text style={{ fontFamily: font.body, color: colors.muted }}>Recibe {order.recipientPhoneMasked}</Text> : null}
                <View style={{ gap: 4 }}>
                  {STATUS_FLOW.map((status) => {
                    const reached = STATUS_FLOW.indexOf(status) <= STATUS_FLOW.indexOf(order.status as (typeof STATUS_FLOW)[number]);
                    return <Text key={status} style={{ fontFamily: font.medium, color: reached ? colors.pine : colors.muted }}>{reached ? "●" : "○"} {STATUS_LABEL[status]}</Text>;
                  })}
                </View>
                <Text style={{ fontFamily: font.medium, color: colors.muted }}>Ref. {order.number}</Text>
                <Button label="Abrir pedido" tone="ghost" onPress={() => router.push(`/pedido/${order.publicToken}`)} />
              </View>
            ))}
          </>
        ) : (
          <PhoneVerify title="Rastrea tu pedido" onVerified={(phone) => void load(phone)} />
        )}
      </View>
    </Screen>
  );
}
