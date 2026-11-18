import { Pressable, ScrollView, Text, View } from "react-native";
import { useApp, useRepo } from "../../components/provider";
import { colors, font } from "../../components/theme";
import { getRepo } from "../../lib/repo";

export default function RetablosAdmin() {
  const { refresh } = useApp();
  const { data } = useRepo((repo) => repo.listRetabloInquiries());
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Retablos</Text>
      <Text style={{ fontFamily: font.body, color: colors.muted }}>Solo el tamaño y la hora. El contacto llega por WhatsApp.</Text>
      {(data ?? []).map((item) => (
        <View key={item.id} style={{ backgroundColor: colors.white, borderRadius: 16, padding: 12, gap: 6 }}>
          <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{item.size}</Text>
          <Text style={{ fontFamily: font.body, color: colors.muted }}>{new Date(item.createdAt).toLocaleString("es-PE", { timeZone: "America/Lima" })} · {item.status}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {(["contacted", "closed"] as const).map((status) => (
              <Pressable key={status} onPress={() => void getRepo().setRetabloInquiryStatus(item.id, status).then(refresh)} style={{ minHeight: 44, justifyContent: "center" }}>
                <Text style={{ fontFamily: font.semibold, color: colors.red }}>{status === "contacted" ? "Contactado" : "Cerrar"}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
      {(data ?? []).length === 0 ? <Text style={{ fontFamily: font.body, color: colors.muted }}>Todavía no hay consultas.</Text> : null}
    </ScrollView>
  );
}
