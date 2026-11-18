import { ScrollView, Text, Pressable, View } from "react-native";
import { useApp, useRepo } from "../../components/provider";
import { colors, font } from "../../components/theme";
import { getRepo } from "../../lib/repo";

export default function Reclamos() {
  const { refresh } = useApp();
  const { data } = useRepo((repo) => repo.listClaims());
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Reclamos</Text>
      {(data ?? []).map((claim) => (
        <View key={claim.id} style={{ backgroundColor: colors.white, borderRadius: 16, padding: 12, gap: 8 }}>
          <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{claim.orderNumber} · {claim.status}</Text>
          <Text style={{ fontFamily: font.body, color: colors.muted }}>{claim.note}</Text>
          {claim.status === "open" ? (
            <Pressable onPress={() => void getRepo().startRemake(claim.id).then(refresh)} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={{ fontFamily: font.semibold, color: colors.red }}>Iniciar reposición</Text>
            </Pressable>
          ) : null}
        </View>
      ))}
    </ScrollView>
  );
}
