import { useState } from "react";
import { Text, View } from "react-native";
import { PhoneVerify } from "../components/PhoneVerify";
import { Button, Field, Screen } from "../components/ui";
import { colors, font } from "../components/theme";
import { getRepo } from "../lib/repo";
import type { CustomerProfile } from "../lib/types";
import type { TrackingCard } from "../lib/tracking";

export default function Cuenta() {
  const [ready, setReady] = useState(false);
  const [profile, setProfile] = useState<CustomerProfile>({ name: "", phone: "", email: "", addresses: [] });
  const [orders, setOrders] = useState<TrackingCard[]>([]);
  const [note, setNote] = useState<string | null>(null);

  async function enter(phone: string) {
    const repo = getRepo();
    const saved = await repo.getProfile();
    setProfile(saved ?? { name: "", phone, email: "", addresses: [] });
    setOrders(await repo.listOrdersByPhone(phone));
    setReady(true);
  }

  async function save() {
    const next = await getRepo().saveProfile(profile);
    setProfile(next);
    setNote("Guardamos tu cuenta.");
  }

  return (
    <Screen>
      <View style={{ padding: 16, gap: 12 }}>
        {!ready ? <PhoneVerify title="Mi cuenta" onVerified={(phone) => void enter(phone)} /> : null}
        {ready ? (
          <>
            <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Mi cuenta</Text>
            <Field label="Nombre" value={profile.name} onChangeText={(name) => setProfile({ ...profile, name })} />
            <Field label="Correo" value={profile.email} onChangeText={(email) => setProfile({ ...profile, email })} keyboardType="email-address" />
            <Field label="Celular" value={profile.phone} editable={false} />
            <Field
              label="Dirección"
              value={profile.addresses[0]?.addressLine ?? ""}
              onChangeText={(addressLine) => setProfile({ ...profile, addresses: [{ id: profile.addresses[0]?.id ?? "addr", addressLine, district: profile.addresses[0]?.district ?? "", province: profile.addresses[0]?.province ?? "", department: profile.addresses[0]?.department ?? "", city: profile.addresses[0]?.city ?? "" }] })}
            />
            <Button label="Guardar" onPress={() => void save()} />
            {note ? <Text style={{ fontFamily: font.body, color: colors.pine }}>{note}</Text> : null}
            <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Pedidos</Text>
            {orders.length === 0 ? <Text style={{ fontFamily: font.body, color: colors.muted }}>Todavía no hay pedidos con este celular.</Text> : null}
            {orders.map((order) => (
              <Text key={order.publicToken} style={{ fontFamily: font.body, color: colors.ink }}>{order.number} · {order.status}{order.trackingNumber ? ` · guía ${order.trackingNumber}` : ""}</Text>
            ))}
          </>
        ) : null}
      </View>
    </Screen>
  );
}
