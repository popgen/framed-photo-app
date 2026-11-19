import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AccountAuth } from "../components/AccountAuth";
import { useReducedMotion } from "../components/fx";
import { Honeypot } from "../components/Honeypot";
import { CONTACT_SUCCESS, HONEYPOT_FIELD } from "../lib/contact";
import { currentCustomer, signOutCustomer, type CustomerSession } from "../lib/customer-auth";
import { isEmail } from "../lib/phone";
import { useContactSend } from "../lib/use-contact";
import { Button, Card, Field, Screen, TabBar } from "../components/ui";
import { colors, font } from "../components/theme";
import { getRepo } from "../lib/repo";
import { useCart } from "../lib/store";
import { STATUS_FLOW, STATUS_LABEL, type CustomerProfile, type OrderStatus } from "../lib/types";
import type { TrackingCard } from "../lib/tracking";
import { DEPARTMENTS, districtsFor, provincesFor } from "../lib/zone";

const DONE = new Set<OrderStatus>(["delivered", "cancelled"]);

export default function Cuenta() {
  const reduced = useReducedMotion();
  const addMany = useCart((state) => state.addMany);
  const [phone, setPhone] = useState("");
  const [account, setAccount] = useState<CustomerSession | null | undefined>(undefined);
  const [profile, setProfile] = useState<CustomerProfile>({ name: "", phone: "", email: "", addresses: [] });
  const [orders, setOrders] = useState<TrackingCard[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [support, setSupport] = useState("");
  const [honey, setHoney] = useState("");
  const [picker, setPicker] = useState<"department" | "province" | "district" | null>(null);
  const supportSend = useContactSend();

  const address = profile.addresses[0] ?? emptyAddress();
  const provinces = provincesFor(address.department);
  const districts = districtsFor(address.department, address.province);
  const ongoing = orders.filter((order) => !DONE.has(order.status));
  const past = orders.filter((order) => DONE.has(order.status));

  useEffect(() => {
    void currentCustomer().then((session) => {
      setAccount(session);
      if (session) void enter(session);
    });
  }, []);

  async function enter(session: CustomerSession) {
    const repo = getRepo();
    const saved = await repo.getProfile();
    setPhone(saved?.phone || "");
    setProfile(saved?.phone ? { ...saved, email: saved.email || session.email } : { name: "", phone: "", email: session.email, addresses: [] });
    setOrders(await repo.listMyOrders());
  }

  async function leave() {
    await signOutCustomer();
    setAccount(null);
    setOrders([]);
  }

  function patchAddress(partial: Partial<typeof address>) {
    setProfile({ ...profile, addresses: [{ ...address, ...partial }] });
  }

  async function save() {
    const next = await getRepo().saveProfile({ ...profile, phone });
    setProfile(next);
    setNote("Guardamos tu cuenta.");
  }

  async function reorder(card: TrackingCard) {
    const order = await getRepo().getOrderByToken(card.publicToken, phone);
    if (!order?.items.length) return;
    addMany(order.items.map((item) => ({ ...item, id: `${item.id}-re` })));
    router.push("/carrito");
  }

  async function sendSupport() {
    const latest = orders[0];
    const noteText = support.trim();
    if (noteText.length < 2) {
      supportSend.setError("Escribe tu mensaje.");
      return;
    }
    const email = isEmail(profile.email) ? profile.email.trim() : "";
    const sent = await supportSend.send(
      {
        type: "pedido",
        name: profile.name.trim(),
        email,
        phone: (profile.phone || phone).trim(),
        message: noteText,
        orderNumber: latest?.number ?? "",
        [HONEYPOT_FIELD]: honey,
      },
      {
        after: async () => {
          if (latest) await getRepo().createClaim({ token: latest.publicToken, phone, note: noteText });
        },
      },
    );
    if (sent) setSupport("");
  }

  return (
    <Screen footer={<TabBar />}>
      <View style={{ padding: 16, gap: 14 }}>
        {account === undefined ? <Text style={{ fontFamily: font.body, color: colors.muted }}>Un momento…</Text> : null}
        {account === null ? <AccountAuth title="Mi cuenta" onReady={(session) => { setAccount(session); void enter(session); }} /> : null}
        {account ? (
          <>
            <Animated.View entering={reduced ? undefined : FadeInDown.springify().damping(16)}>
              <Text accessibilityRole="header" style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Mi cuenta</Text>
            </Animated.View>
            <Card>
              <Field label="Nombre" value={profile.name} onChangeText={(name) => setProfile({ ...profile, name })} />
              <View style={{ height: 8 }} />
              <Field label="Correo" value={profile.email} onChangeText={(email) => setProfile({ ...profile, email })} keyboardType="email-address" autoCapitalize="none" />
              <View style={{ height: 8 }} />
              <Field label="Celular" keyboardType="phone-pad" placeholder="987 654 321" value={profile.phone} onChangeText={(next) => { setProfile({ ...profile, phone: next }); setPhone(next); }} />
            </Card>
            <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Dirección</Text>
            <Pressable onPress={() => setPicker("department")} style={choice}><Text style={choiceLabel}>Departamento</Text><Text style={choiceValue}>{address.department || "Elegir"}</Text></Pressable>
            <Pressable onPress={() => address.department && setPicker("province")} style={choice}><Text style={choiceLabel}>Provincia</Text><Text style={choiceValue}>{address.province || "Elegir"}</Text></Pressable>
            <Pressable onPress={() => address.province && setPicker("district")} style={choice}><Text style={choiceLabel}>Distrito</Text><Text style={choiceValue}>{address.district || "Elegir"}</Text></Pressable>
            <Field label="Dirección" value={address.addressLine} onChangeText={(addressLine) => patchAddress({ addressLine })} />
            <Field label="Referencia" value={address.reference ?? ""} onChangeText={(reference) => patchAddress({ reference })} />
            <Button label="Guardar" onPress={() => void save()} />
            <Button label="Salir" tone="ghost" onPress={() => void leave()} />
            {note ? <Text style={{ fontFamily: font.body, color: colors.pine }}>{note}</Text> : null}
            <Text style={{ fontFamily: font.semibold, color: colors.ink }}>En camino</Text>
            {ongoing.length === 0 ? <Text style={{ fontFamily: font.body, color: colors.muted }}>No tienes pedidos abiertos.</Text> : null}
            {ongoing.map((order) => <OrderCard key={order.publicToken || order.number} order={order} onOpen={() => order.publicToken && router.push(`/pedido/${order.publicToken}`)} />)}
            <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Anteriores</Text>
            {past.length === 0 ? <Text style={{ fontFamily: font.body, color: colors.muted }}>Todavía no hay pedidos entregados.</Text> : null}
            {past.map((order) => <OrderCard key={order.publicToken || order.number} order={order} onOpen={() => order.publicToken && router.push(`/pedido/${order.publicToken}`)} onReorder={() => void reorder(order)} />)}
            <Card>
              <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Hablar con Mi Fotito</Text>
              <TextInput value={support} onChangeText={setSupport} placeholder="Cuéntanos en qué te ayudamos" placeholderTextColor="#A89488" multiline style={{ minHeight: 80, marginTop: 8, backgroundColor: colors.bg, borderRadius: 12, padding: 12, fontFamily: font.body, fontSize: 16 }} />
              <Honeypot value={honey} onChangeText={setHoney} />
              <View style={{ height: 8 }} />
              {supportSend.error ? <Text style={{ fontFamily: font.body, color: colors.bad, marginBottom: 8 }}>{supportSend.error}</Text> : null}
              {supportSend.sent ? <Text style={{ fontFamily: font.medium, color: colors.pine, marginBottom: 8 }}>{CONTACT_SUCCESS}</Text> : null}
              <Button label={supportSend.busy ? "Enviando…" : "Enviar por correo"} disabled={supportSend.busy || supportSend.sent} onPress={() => void sendSupport()} />
            </Card>
          </>
        ) : null}
        {picker ? (
          <View style={{ backgroundColor: colors.white, borderRadius: 16, padding: 12, gap: 8 }}>
            {(picker === "department" ? DEPARTMENTS : picker === "province" ? provinces : districts).map((item) => (
              <Pressable key={item} onPress={() => { if (picker === "department") patchAddress({ department: item, province: "", district: "", city: "" }); else if (picker === "province") patchAddress({ province: item, district: "", city: "" }); else patchAddress({ district: item, city: item }); setPicker(null); }} style={{ minHeight: 44, justifyContent: "center" }}>
                <Text style={{ fontFamily: font.medium, color: colors.ink }}>{item}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

function OrderCard({ order, onOpen, onReorder }: { order: TrackingCard; onOpen: () => void; onReorder?: () => void }) {
  return (
    <Card>
      <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{STATUS_LABEL[order.status]} · {order.number}</Text>
      <Text style={{ fontFamily: font.body, color: colors.muted }}>{order.etaLabel}{order.trackingNumber ? ` · Guía ${order.trackingNumber}` : ""}</Text>
      <View style={{ gap: 2, marginVertical: 6 }}>
        {STATUS_FLOW.map((status) => {
          const reached = STATUS_FLOW.indexOf(status) <= STATUS_FLOW.indexOf(order.status);
          return <Text key={status} style={{ fontFamily: font.medium, color: reached ? colors.pine : colors.muted }}>{reached ? "●" : "○"} {STATUS_LABEL[status]}</Text>;
        })}
      </View>
      <Button label="Ver estado" tone="ghost" onPress={onOpen} />
      {onReorder ? <View style={{ height: 8 }} /> : null}
      {onReorder ? <Button label="Pedir de nuevo" tone="ghost" onPress={onReorder} /> : null}
    </Card>
  );
}

function emptyAddress() {
  return { id: "addr", addressLine: "", district: "", province: "", department: "", city: "", reference: "" };
}

const choice = { minHeight: 52, borderRadius: 14, backgroundColor: colors.white, paddingHorizontal: 14, justifyContent: "center" as const };
const choiceLabel = { fontFamily: font.medium, fontSize: 12, color: colors.muted };
const choiceValue = { fontFamily: font.semibold, color: colors.ink };
