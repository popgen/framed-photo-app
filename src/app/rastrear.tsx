import { useState } from "react";
import { Text, View } from "react-native";
import { Button, Field, Screen } from "../components/ui";
import { colors, font } from "../components/theme";
import { normalizePhone } from "../lib/phone";
import { getRepo } from "../lib/repo";
import { STATUS_LABEL, type OrderStatus } from "../lib/types";
import type { PublicShipment } from "../lib/tracking";

export default function Rastrear() {
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<PublicShipment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError("Ingresa un celular peruano de 9 dígitos.");
      setOrders(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const rows = await getRepo().listPublicTracking(normalized);
      setOrders(rows);
      setError(rows.length ? null : "No hay envíos pendientes con este celular.");
    } catch (err) {
      setOrders(null);
      setError(err instanceof Error ? err.message : "No pudimos buscar el envío.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      <View style={{ padding: 16, gap: 14 }}>
        <Text accessibilityRole="header" style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Rastrea tu pedido</Text>
        <Text style={{ fontFamily: font.body, color: colors.muted }}>Delivery en Lima, de 2 a 3 días hábiles, y a provincias de 3 a 5. Solo mostramos envíos que todavía no se entregaron. No pedimos una cuenta.</Text>
        <Field label="Celular" keyboardType="phone-pad" placeholder="987 654 321" value={phone} onChangeText={setPhone} />
        <Button label={busy ? "Un momento…" : "Ver envíos"} disabled={busy} onPress={() => void load()} />
        {error ? <Text style={{ fontFamily: font.body, color: colors.muted }}>{error}</Text> : null}
        {orders?.map((order) => (
          <View key={order.number} style={{ backgroundColor: colors.white, borderRadius: 16, padding: 12, gap: 6 }}>
            <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{order.number}</Text>
            {order.nameHint ? <Text style={{ fontFamily: font.body, color: colors.muted }}>{order.nameHint}</Text> : null}
            <Text style={{ fontFamily: font.body, color: colors.ink }}>{order.itemLabel}</Text>
            <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{STATUS_LABEL[order.status as OrderStatus]}</Text>
            <Text style={{ fontFamily: font.body, color: colors.muted }}>{order.etaLabel}</Text>
            <View style={{ gap: 4 }}>
              {order.timeline.map((step) => (
                <Text key={step.status} style={{ fontFamily: font.medium, color: step.reached ? colors.pine : colors.muted }}>{step.reached ? "●" : "○"} {step.label}</Text>
              ))}
            </View>
          </View>
        ))}
      </View>
    </Screen>
  );
}
