import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { useApp, useRepo } from "../../components/provider";
import { colors, font } from "../../components/theme";
import { getRepo } from "../../lib/repo";

export default function Inventario() {
  const { refresh } = useApp();
  const { data } = useRepo((repo) => repo.listInventory());
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
      <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Stock</Text>
      <Text style={{ fontFamily: font.body, color: colors.muted }}>Los premium con paspartú comparten el cuerpo 30×40 y el paspartú blanco. Aviso en 5 unidades. Se descuenta al pagar.</Text>
      {(data ?? []).map((item) => (
        <View key={item.sku} style={{ backgroundColor: item.quantity <= item.lowStockAt ? "#FFF1DE" : colors.white, borderRadius: 16, padding: 12, gap: 6 }}>
          <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{item.name}</Text>
          <Text style={{ fontFamily: font.body, color: colors.muted }}>{item.quantity <= item.lowStockAt ? "Stock bajo" : "En orden"} · {item.sku}</Text>
          <TextInput
            defaultValue={String(item.quantity)}
            keyboardType="numeric"
            onChangeText={(value) => setDrafts({ ...drafts, [item.sku]: value })}
            onEndEditing={() => {
              const next = drafts[item.sku];
              if (next == null) return;
              void getRepo().setInventory(item.sku, Number(next)).then(refresh);
            }}
            style={{ minHeight: 44, backgroundColor: colors.bg, borderRadius: 10, paddingHorizontal: 10, fontFamily: font.body }}
          />
        </View>
      ))}
    </ScrollView>
  );
}
