import { router } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { useApp, useRepo } from "../../components/provider";
import { colors, font } from "../../components/theme";
import { defaultCampaign } from "../../lib/campaign";
import { cutoffInstant, urgencyRank } from "../../lib/cutoff";
import { formatSoles } from "../../lib/money";
import { giftWrapBadge } from "../../lib/order-admin";
import { STATUS_LABEL, type OrderStatus } from "../../lib/types";

const FILTERS = ["all", "pending_payment", "paid", "in_review", "printed", "framed", "shipped", "delivered", "cancelled"] as const;

export default function AdminHome() {
  const { refresh } = useApp();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [query, setQuery] = useState("");
  const [urgent, setUrgent] = useState(true);
  const { data: orders } = useRepo((repo) => repo.listOrders(filter === "all" ? undefined : filter), [filter]);
  const { data: customers } = useRepo((repo) => repo.listCustomers(), []);
  const { data: campaign } = useRepo((repo) => repo.getCampaign());
  const active = campaign ?? defaultCampaign;
  const rows = [...(orders ?? [])].sort((a, b) => {
    if (!urgent) return b.createdAt.localeCompare(a.createdAt);
    const rank = (order: (typeof orders extends (infer T)[] | null ? T : never)) =>
      urgencyRank(cutoffInstant(active, order.zone).getTime(), order.status === "delivered" || order.status === "cancelled");
    return rank(a) - rank(b);
  });
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Pedidos</Text>
      <TextInput value={query} onChangeText={setQuery} placeholder="Buscar MF-26-1004" placeholderTextColor="#A89488" style={{ minHeight: 48, borderRadius: 12, backgroundColor: colors.white, paddingHorizontal: 12, fontFamily: font.body }} />
      <Pressable onPress={() => void getToggle(active.seasonalMotion, refresh)} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={{ fontFamily: font.medium, color: colors.ink }}>{active.seasonalMotion ? "☑" : "☐"} Movimiento de {active.occasionName}</Text>
      </Pressable>
      <Pressable onPress={() => setUrgent((value) => !value)} style={{ minHeight: 44, justifyContent: "center" }}>
        <Text style={{ fontFamily: font.medium, color: colors.ink }}>{urgent ? "Ordenado por urgencia de Navidad" : "Ordenado por fecha"}</Text>
      </Pressable>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {FILTERS.map((item) => (
          <Pressable key={item} onPress={() => setFilter(item)} style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: filter === item ? colors.ink : colors.white }}>
            <Text style={{ fontFamily: font.semibold, color: filter === item ? "white" : colors.ink }}>{item === "all" ? "Todos" : STATUS_LABEL[item as OrderStatus]}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {rows.filter((order) => !query.trim() || order.number.toLowerCase().includes(query.trim().toLowerCase()) || order.customerName.toLowerCase().includes(query.trim().toLowerCase())).map((order) => (
        <Pressable key={order.id} onPress={() => router.push(`/admin/pedido/${order.id}`)} style={{ minHeight: 72, backgroundColor: colors.white, borderRadius: 16, padding: 12, justifyContent: "center" }}>
          <Text style={{ fontFamily: font.semibold, color: colors.ink }}>
            {order.number} · {STATUS_LABEL[order.status]} {order.channel === "whatsapp" ? "· WhatsApp" : ""}
          </Text>
          <Text style={{ fontFamily: font.body, color: colors.muted }}>
            {order.customerName} · {order.zone === "lima" ? "Lima" : "Provincias"} · {order.christmasGuaranteed ? "Llega a la fecha" : "Sin garantía"}
            {order.needsHuman ? " · pide una persona" : ""}
            {order.giftWrap ? ` · ${giftWrapBadge(active.giftWrapTitle)}` : ""}
            {` · ${formatSoles(order.totalCents)}`}
          </Text>
        </Pressable>
      ))}
      <Text style={{ fontFamily: font.display, fontSize: 28, color: colors.ink, marginTop: 12 }}>Clientes</Text>
      {(customers ?? []).map((customer) => (
        <View key={customer.id} style={{ backgroundColor: colors.white, borderRadius: 16, padding: 12 }}>
          <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{customer.name || "Sin nombre"} · {customer.phone}</Text>
          {customer.email ? <Text style={{ fontFamily: font.body, color: colors.muted }}>{customer.email}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

async function getToggle(current: boolean, refresh: () => void) {
  const { getRepo } = await import("../../lib/repo");
  await getRepo().setSeasonalMotion(!current);
  refresh();
}
