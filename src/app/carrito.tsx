import { router } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { FrameView } from "../components/FrameView";
import { PriceTicker } from "../components/fx";
import { Button, Card, Progress, Screen, TabBar } from "../components/ui";
import { colors, font } from "../components/theme";
import { frameById } from "../lib/catalog";
import { formatSoles } from "../lib/money";
import { quote } from "../lib/pricing";
import { useCart } from "../lib/store";

export default function Carrito() {
  const items = useCart((state) => state.items);
  const remove = useCart((state) => state.remove);
  const priced = quote({ items: items.map((item) => ({ unitPriceCents: frameById(item.frameId).priceCents })) });
  return (
    <Screen
      footer={
        <View>
          <View style={{ padding: 16, gap: 8, backgroundColor: colors.bg }}>
            <PriceTicker cents={priced.totalCents} />
            <Button label="Continuar al pago" disabled={!items.length} onPress={() => router.push("/checkout")} />
          </View>
          <TabBar />
        </View>
      }
    >
      <View style={{ padding: 16, gap: 12 }}>
        <Progress step={3} />
        <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Tu carrito</Text>
        {!items.length ? <Text style={{ fontFamily: font.body, color: colors.muted }}>Todavía no hay marcos. Arma el primero.</Text> : null}
        {items.map((item) => {
          const frame = frameById(item.frameId);
          return (
            <Card key={item.id}>
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <FrameView frame={frame} photoId={item.photoId} crop={item.crop} orientation={item.orientation} width={78} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{frame.name}</Text>
                  <Text style={{ fontFamily: font.body, color: colors.muted }}>{frame.sizeLabel}</Text>
                  {item.bundleLabel ? <Text style={{ fontFamily: font.medium, color: colors.pine }}>{item.bundleLabel}</Text> : null}
                  <Text style={{ fontFamily: font.bold, color: colors.ink }}>{formatSoles(frame.priceCents)}</Text>
                </View>
              </View>
              <Pressable onPress={() => remove(item.id)} style={{ minHeight: 44, justifyContent: "center" }}>
                <Text style={{ fontFamily: font.semibold, color: colors.bad }}>Quitar</Text>
              </Pressable>
            </Card>
          );
        })}
        {priced.frameDiscountLabel ? (
          <Text style={{ fontFamily: font.medium, color: colors.pine }}>
            {priced.frameDiscountLabel}: -{formatSoles(priced.frameDiscountCents)}
          </Text>
        ) : (
          <Text style={{ fontFamily: font.body, color: colors.muted }}>El segundo marco va con 20% de descuento. Desde el tercero, el set baja 15%.</Text>
        )}
      </View>
    </Screen>
  );
}
