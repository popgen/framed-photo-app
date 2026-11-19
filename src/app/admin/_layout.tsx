import { router, Slot, usePathname } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Banner } from "../../components/ui";
import { colors, font } from "../../components/theme";
import { getRepo } from "../../lib/repo";

export default function AdminLayout() {
  const path = usePathname();
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    void getRepo()
      .adminSession()
      .then((gate) => {
        if (!alive) return;
        if (!gate.ok && !path.endsWith("/login")) router.replace("/admin/login");
        if (gate.ok && path.endsWith("/login")) router.replace("/admin");
        setBlocked(gate.ok ? null : gate.message);
        setReady(true);
      });
    return () => {
      alive = false;
    };
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
        {path.endsWith("/login") || path.includes("/nota") ? null : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, padding: 10 }}>
            {links.map(([href, label]) => (
              <Pressable key={href} onPress={() => router.push(href)} style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: "center" }}>
                <Text style={{ fontFamily: font.semibold, color: path === href ? colors.red : colors.ink }}>{label}</Text>
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Salir"
              onPress={() => {
                void getRepo().adminLogout().then(() => router.replace("/admin/login"));
              }}
              style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: "center" }}
            >
              <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Salir</Text>
            </Pressable>
          </View>
        )}
        {path.endsWith("/login") && blocked ? (
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Banner tone="bad" text={blocked} />
          </View>
        ) : null}
        <Slot />
      </View>
    </View>
  );
}
