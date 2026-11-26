import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AccountAuth } from "../components/AccountAuth";
import { useReducedMotion } from "../components/fx";
import { Honeypot } from "../components/Honeypot";
import { CONTACT_SUCCESS, HONEYPOT_FIELD } from "../lib/contact";
import { addressLines, emptyAddress, newestFirst, orderDateLabel, ORDERS_PREVIEW, phoneLabel, profileForSave, profileIsFilled, profileProblem } from "../lib/account-view";
import { currentCustomer, signOutCustomer, type CustomerSession } from "../lib/customer-auth";
import { formatSoles } from "../lib/money";
import { isEmail } from "../lib/phone";
import { useContactSend } from "../lib/use-contact";
import { Banner, Button, Card, Field, Screen, TabBar } from "../components/ui";
import { colors, font } from "../components/theme";
import { getRepo } from "../lib/repo";
import { useCart } from "../lib/store";
import { STATUS_LABEL, type CustomerProfile, type OrderStatus } from "../lib/types";
import type { TrackingCard } from "../lib/tracking";
import { DEPARTMENTS, districtsFor, provincesFor } from "../lib/zone";

type PickerKey = "department" | "province" | "district";

export default function Cuenta() {
  const reduced = useReducedMotion();
  const addMany = useCart((state) => state.addMany);
  const [phone, setPhone] = useState("");
  const [account, setAccount] = useState<CustomerSession | null | undefined>(undefined);
  const [profile, setProfile] = useState<CustomerProfile>({ name: "", phone: "", email: "", addresses: [] });
  const [saved, setSaved] = useState<CustomerProfile>({ name: "", phone: "", email: "", addresses: [] });
  const [orders, setOrders] = useState<TrackingCard[]>([]);
  const [ordersState, setOrdersState] = useState<"cargando" | "listo" | "error">("cargando");
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [support, setSupport] = useState("");
  const [honey, setHoney] = useState("");
  const [picker, setPicker] = useState<PickerKey | null>(null);
  const supportSend = useContactSend();

  const address = profile.addresses[0] ?? emptyAddress();
  const provinces = provincesFor(address.department);
  const districts = districtsFor(address.department, address.province);
  const sorted = newestFirst(orders);
  const shown = showAll ? sorted : sorted.slice(0, ORDERS_PREVIEW);

  useEffect(() => {
    void currentCustomer().then((session) => {
      setAccount(session);
      if (session) void enter(session);
    });
  }, []);

  async function enter(session: CustomerSession) {
    const repo = getRepo();
    setOrdersState("cargando");
    const stored = await repo.getProfile().catch(() => null);
    const next: CustomerProfile = stored?.phone ? { ...stored, email: stored.email || session.email } : { name: "", phone: "", email: session.email, addresses: [] };
    setPhone(stored?.phone || "");
    setProfile(next);
    setSaved(next);
    setEditing(!profileIsFilled(next));
    try {
      setOrders(await repo.listMyOrders());
      setOrdersState("listo");
    } catch {
      setOrdersState("error");
    }
  }

  async function leave() {
    await signOutCustomer();
    setAccount(null);
    setOrders([]);
    setEditing(false);
    setNote(null);
  }

  function patchAddress(partial: Partial<typeof address>) {
    setProfile({ ...profile, addresses: [{ ...address, ...partial }] });
  }

  function startEdit() {
    setProfile(saved);
    setPhone(saved.phone);
    setProblem(null);
    setNote(null);
    setPicker(null);
    setEditing(true);
  }

  function cancelEdit() {
    setProfile(saved);
    setPhone(saved.phone);
    setProblem(null);
    setPicker(null);
    setEditing(false);
  }

  async function save() {
    if (saving) return;
    const invalid = profileProblem(profile, phone);
    if (invalid) {
      setProblem(invalid);
      return;
    }
    setSaving(true);
    setProblem(null);
    try {
      const next = await getRepo().saveProfile(profileForSave(profile, phone));
      setSaved(next);
      setProfile(next);
      setPhone(next.phone);
      setPicker(null);
      setEditing(false);
      setNote("Guardamos tus datos.");
    } catch (error) {
      setProblem(error instanceof Error && error.message ? error.message : "No pudimos guardar tus datos. Intenta de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  async function reorder(card: TrackingCard) {
    const order = await getRepo().getOrderByToken(card.publicToken, phone);
    if (!order?.items.length) return;
    addMany(order.items.map((item) => ({ ...item, id: `${item.id}-re` })));
    router.push("/carrito");
  }

  async function sendSupport() {
    const latest = sorted[0];
    const noteText = support.trim();
    if (noteText.length < 2) {
      supportSend.setError("Escribe tu mensaje.");
      return;
    }
    const email = isEmail(saved.email) ? saved.email.trim() : "";
    const sent = await supportSend.send(
      {
        type: "pedido",
        name: saved.name.trim(),
        email,
        phone: (saved.phone || phone).trim(),
        message: noteText,
        orderNumber: latest?.number ?? "",
        [HONEYPOT_FIELD]: honey,
      },
      {
        after: async () => {
          if (latest) await getRepo().createClaim({ token: latest.publicToken, phone: saved.phone || phone, note: noteText });
        },
      },
    );
    if (sent) setSupport("");
  }

  function choose(key: PickerKey, item: string) {
    if (key === "department") patchAddress({ department: item, province: "", district: "", city: "" });
    else if (key === "province") patchAddress({ province: item, district: "", city: "" });
    else patchAddress({ district: item, city: item });
    setPicker(null);
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

            {editing ? (
              <Card style={{ gap: 12 }}>
                <Text accessibilityRole="header" style={sectionTitle}>{profileIsFilled(saved) ? "Editar mis datos" : "Completa tus datos"}</Text>
                <Field label="Nombre" value={profile.name} onChangeText={(name) => setProfile({ ...profile, name })} autoComplete="name" />
                <Field label="Correo" value={profile.email} onChangeText={(email) => setProfile({ ...profile, email })} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
                <Field label="Celular" keyboardType="phone-pad" placeholder="987 654 321" value={profile.phone} onChangeText={(next) => { setProfile({ ...profile, phone: next }); setPhone(next); }} autoComplete="tel" />
                <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Dirección</Text>
                <ChoiceField label="Departamento" value={address.department} open={picker === "department"} items={DEPARTMENTS} onToggle={() => setPicker(picker === "department" ? null : "department")} onPick={(item) => choose("department", item)} />
                <ChoiceField label="Provincia" value={address.province} open={picker === "province"} items={provinces} disabled={!address.department} onToggle={() => setPicker(picker === "province" ? null : "province")} onPick={(item) => choose("province", item)} />
                <ChoiceField label="Distrito" value={address.district} open={picker === "district"} items={districts} disabled={!address.province} onToggle={() => setPicker(picker === "district" ? null : "district")} onPick={(item) => choose("district", item)} />
                <Field label="Dirección" value={address.addressLine} onChangeText={(addressLine) => patchAddress({ addressLine })} autoComplete="street-address" />
                <Field label="Referencia" value={address.reference ?? ""} onChangeText={(reference) => patchAddress({ reference })} />
                {problem ? <Banner tone="bad" text={problem} /> : null}
                <Button label={saving ? "Guardando…" : "Guardar"} disabled={saving} onPress={() => void save()} />
                {profileIsFilled(saved) ? <Button label="Cancelar" tone="ghost" disabled={saving} onPress={cancelEdit} /> : null}
              </Card>
            ) : (
              <Card style={{ gap: 10 }}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <Text accessibilityRole="header" style={sectionTitle}>Mis datos</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Editar mis datos" onPress={startEdit} style={editChip}>
                    <Text style={{ fontFamily: font.semibold, color: colors.redDark }}>Editar</Text>
                  </Pressable>
                </View>
                {note ? <Banner tone="good" text={note} /> : null}
                <SummaryRow label="Nombre" value={saved.name} />
                <SummaryRow label="Correo" value={saved.email} />
                <SummaryRow label="Celular" value={phoneLabel(saved.phone)} />
                <SummaryRow label="Dirección" value={addressLines(saved.addresses[0]).join("\n")} empty="Todavía no guardas una dirección." />
              </Card>
            )}

            <Text accessibilityRole="header" style={sectionTitle}>Mis pedidos</Text>
            {ordersState === "cargando" ? <Text style={{ fontFamily: font.body, color: colors.muted }}>Buscando tus pedidos…</Text> : null}
            {ordersState === "error" ? <Banner tone="warn" text="No pudimos cargar tus pedidos. Recarga la página en un momento." /> : null}
            {ordersState === "listo" && orders.length === 0 ? (
              <Card style={{ gap: 10 }}>
                <Text style={{ fontFamily: font.body, color: colors.muted }}>Todavía no tienes pedidos.</Text>
                <Button label="Crear mi primer marco" onPress={() => router.push("/crear")} />
              </Card>
            ) : null}
            {shown.map((order) => (
              <OrderRow
                key={order.publicToken || order.number}
                order={order}
                onOpen={() => order.publicToken && router.push(`/pedido/${order.publicToken}`)}
                onReorder={order.status === "delivered" ? () => void reorder(order) : undefined}
              />
            ))}
            {sorted.length > ORDERS_PREVIEW ? <Button label={showAll ? "Ver menos" : `Ver todos (${sorted.length})`} tone="ghost" onPress={() => setShowAll(!showAll)} /> : null}

            <Text accessibilityRole="header" style={sectionTitle}>Chat con Mi Fotito</Text>
            <Card>
              <Text style={{ fontFamily: font.body, color: colors.muted, lineHeight: 20 }}>Escríbenos sobre tu pedido o cualquier duda. Te respondemos por correo{isEmail(saved.email) ? ` a ${saved.email.trim()}` : ""}.</Text>
              <TextInput accessibilityLabel="Tu mensaje" value={support} onChangeText={setSupport} placeholder="Cuéntanos en qué te ayudamos" placeholderTextColor="#A89488" multiline style={{ minHeight: 96, marginTop: 10, backgroundColor: colors.bg, borderRadius: 12, padding: 12, fontFamily: font.body, fontSize: 16, color: colors.ink, textAlignVertical: "top" }} />
              <Honeypot value={honey} onChangeText={setHoney} />
              <View style={{ height: 8 }} />
              {supportSend.error ? <Text style={{ fontFamily: font.body, color: colors.bad, marginBottom: 8 }}>{supportSend.error}</Text> : null}
              {supportSend.sent ? <Text style={{ fontFamily: font.medium, color: colors.pine, marginBottom: 8 }}>{CONTACT_SUCCESS}</Text> : null}
              <Button label={supportSend.busy ? "Enviando…" : "Enviar mensaje"} disabled={supportSend.busy || supportSend.sent} onPress={() => void sendSupport()} />
            </Card>

            <Button label="Salir" tone="ghost" onPress={() => void leave()} />
          </>
        ) : null}
      </View>
    </Screen>
  );
}

function SummaryRow({ label, value, empty }: { label: string; value: string; empty?: string }) {
  const text = value.trim();
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.muted }}>{label}</Text>
      <Text selectable style={{ fontFamily: text ? font.medium : font.body, fontSize: 16, lineHeight: 22, color: text ? colors.ink : colors.muted }}>{text || empty || "—"}</Text>
    </View>
  );
}

function ChoiceField({ label, value, open, items, disabled, onToggle, onPick }: { label: string; value: string; open: boolean; items: string[]; disabled?: boolean; onToggle: () => void; onPick: (item: string) => void }) {
  return (
    <View>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open, disabled: !!disabled }} accessibilityLabel={`${label}: ${value || "Elegir"}`} onPress={() => !disabled && onToggle()} style={[choice, open && { borderColor: colors.red }, disabled && { opacity: 0.55 }]}>
        <Text style={choiceLabel}>{label}</Text>
        <Text style={choiceValue}>{value || "Elegir"}</Text>
      </Pressable>
      {open ? (
        <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={choiceList}>
          {items.map((item) => (
            <Pressable key={item} accessibilityRole="button" onPress={() => onPick(item)} style={[choiceItem, item === value && { backgroundColor: "#FBEFE3" }]}>
              <Text style={{ fontFamily: item === value ? font.semibold : font.medium, color: colors.ink }}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

const BADGE: Record<OrderStatus, { bg: string; fg: string }> = {
  pending_payment: { bg: "#FFF1DE", fg: colors.warn },
  paid: { bg: "#E5F5EC", fg: colors.good },
  in_review: { bg: "#E5F5EC", fg: colors.good },
  printed: { bg: "#E5F5EC", fg: colors.good },
  framed: { bg: "#E5F5EC", fg: colors.good },
  shipped: { bg: "#E5F5EC", fg: colors.good },
  delivered: { bg: "#E5F5EC", fg: colors.pine },
  cancelled: { bg: "#F1E8E0", fg: colors.muted },
};

function OrderRow({ order, onOpen, onReorder }: { order: TrackingCard; onOpen: () => void; onReorder?: () => void }) {
  const badge = BADGE[order.status] ?? BADGE.paid;
  const date = orderDateLabel(order.createdAt);
  const open = order.status !== "delivered" && order.status !== "cancelled";
  return (
    <Card style={{ gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <Text style={{ fontFamily: font.semibold, fontSize: 16, color: colors.ink }}>{order.number}</Text>
        <View style={{ backgroundColor: badge.bg, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 }}>
          <Text style={{ fontFamily: font.semibold, fontSize: 12, color: badge.fg }}>{STATUS_LABEL[order.status]}</Text>
        </View>
      </View>
      <Text style={{ fontFamily: font.body, color: colors.muted }}>
        {[date, order.totalCents > 0 ? formatSoles(order.totalCents) : "", order.itemCount > 1 ? `${order.itemCount} artículos` : ""].filter(Boolean).join(" · ")}
      </Text>
      {open && order.etaLabel ? <Text style={{ fontFamily: font.body, color: colors.muted }}>{order.etaLabel}{order.trackingNumber ? ` · Guía ${order.trackingNumber}` : ""}</Text> : null}
      <Button label="Ver pedido" tone="ghost" onPress={onOpen} />
      {onReorder ? <Button label="Pedir de nuevo" tone="ghost" onPress={onReorder} /> : null}
    </Card>
  );
}

const sectionTitle = { fontFamily: font.displaySoft, fontSize: 20, color: colors.ink };
const editChip = { minHeight: 44, minWidth: 64, paddingHorizontal: 16, borderRadius: 99, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: "center" as const, justifyContent: "center" as const };
const choice = { minHeight: 52, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 6, justifyContent: "center" as const };
const choiceLabel = { fontFamily: font.medium, fontSize: 12, color: colors.muted };
const choiceValue = { fontFamily: font.semibold, color: colors.ink };
const choiceList = { maxHeight: 240, marginTop: 6, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line };
const choiceItem = { minHeight: 44, justifyContent: "center" as const, paddingHorizontal: 14 };
