import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useApp, useRepo } from "../../components/provider";
import { Button, Field } from "../../components/ui";
import { colors, font } from "../../components/theme";
import { formatSoles } from "../../lib/money";
import { getRepo } from "../../lib/repo";

export default function Comercial() {
  const { refresh } = useApp();
  const { data: promos } = useRepo((repo) => repo.listPromos());
  const { data: cards } = useRepo((repo) => repo.listGiftCards());
  const { data: referrals } = useRepo((repo) => repo.listReferrals());
  const [code, setCode] = useState("");
  const [kind, setKind] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("10");
  const [maxUses, setMaxUses] = useState("100");
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Códigos</Text>
      <Field label="Código" autoCapitalize="characters" value={code} onChangeText={setCode} />
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable onPress={() => setKind("percent")} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ fontFamily: font.semibold, color: colors.ink }}>{kind === "percent" ? "☑" : "☐"} Porcentaje</Text></Pressable>
        <Pressable onPress={() => setKind("fixed")} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ fontFamily: font.semibold, color: colors.ink }}>{kind === "fixed" ? "☑" : "☐"} Soles</Text></Pressable>
      </View>
      <Field label={kind === "percent" ? "Porcentaje" : "Céntimos"} value={value} onChangeText={setValue} />
      <Field label="Usos máximos" value={maxUses} onChangeText={setMaxUses} />
      <Button
        label="Guardar promo"
        onPress={() => {
          void getRepo()
            .savePromo({ code, kind, value: Number(value), maxUses: Number(maxUses), usedCount: 0, active: true, expiresAt: "2027-02-14T23:59:59-05:00" })
            .then(refresh);
        }}
      />
      {(promos ?? []).map((promo) => (
        <Text key={promo.code} style={{ fontFamily: font.body, color: colors.ink }}>{promo.code} · {promo.kind === "percent" ? `${promo.value}%` : formatSoles(promo.value)} · {promo.usedCount}/{promo.maxUses ?? "∞"}</Text>
      ))}
      <Text style={{ fontFamily: font.displaySoft, fontSize: 24, color: colors.ink }}>Tarjetas de regalo</Text>
      {(cards ?? []).map((card) => (
        <Text key={card.code} style={{ fontFamily: font.body, color: colors.ink }}>{card.code} · saldo {formatSoles(card.balanceCents)} · {card.recipientPhone}</Text>
      ))}
      <Text style={{ fontFamily: font.displaySoft, fontSize: 24, color: colors.ink }}>Referidos</Text>
      {(referrals ?? []).map((item) => (
        <Text key={item.code} style={{ fontFamily: font.body, color: colors.ink }}>{item.code} · {item.ownerName} · canjes {item.redeemedCount}</Text>
      ))}
    </ScrollView>
  );
}
