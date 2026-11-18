import { router, Slot, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { getRepo } from "../../lib/repo";
import { colors, font } from "../../components/theme";

export default function AdminLayout() {
  const path = usePathname();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    void getRepo()
      .adminSession()
      .then((ok) => {
        if (!ok && !path.endsWith("/login")) router.replace("/admin/login");
        if (ok && path.endsWith("/login")) router.replace("/admin");
        setReady(true);
      });
  }, [path]);
  if (!ready) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  const links = [
    ["/admin", "Pedidos"],
    ["/admin/inventario", "Stock"],
    ["/admin/comercial", "Códigos"],
    ["/admin/reclamos", "Reclamos"],
    ["/admin/whatsapp", "WhatsApp"],
    ["/admin/retablos", "Retablos"],
  ] as const;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep, alignItems: "center" }}>
      <View style={{ flex: 1, width: "100%", maxWidth: 480, backgroundColor: colors.bg }}>
        {path.endsWith("/login") ? null : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 10 }}>
            {links.map(([href, label]) => (
              <Pressable key={href} onPress={() => router.push(href)} style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: "center" }}>
                <Text style={{ fontFamily: font.semibold, color: path === href ? colors.red : colors.ink }}>{label}</Text>
              </Pressable>
            ))}
          </View>
        )}
        <Slot />
      </View>
    </View>
  );
}
