import Head from "expo-router/head";
import { router } from "expo-router";
import { Text, View } from "react-native";
import { Button, Screen } from "../components/ui";
import { colors, font } from "../components/theme";
import { formatSoles } from "../lib/money";
import { useCart } from "../lib/store";
import { TEST_PRODUCT_CENTS, TEST_PRODUCT_NAME, testCartItem, testProductEnabled } from "../lib/test-product";

export default function Prueba() {
  const clear = useCart((state) => state.clear);
  const add = useCart((state) => state.add);
  const enabled = testProductEnabled();

  return (
    <Screen>
      <Head>
        <title>Producto de prueba</title>
        <meta name="robots" content="noindex, nofollow" />
      </Head>
      <View style={{ padding: 16, gap: 12 }}>
        <Text accessibilityRole="header" style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>{TEST_PRODUCT_NAME}</Text>
        {enabled ? (
          <>
            <Text style={{ fontFamily: font.body, color: colors.muted, lineHeight: 22 }}>
              Sirve para probar un pago real de {formatSoles(TEST_PRODUCT_CENTS)}. No está en el catálogo y no entra a producción. El envío es S/ 0.
            </Text>
            <Text style={{ fontFamily: font.display, fontSize: 28, color: colors.ink }}>{formatSoles(TEST_PRODUCT_CENTS)}</Text>
            <Button
              label="Agregar al carrito"
              onPress={() => {
                clear();
                add(testCartItem());
                router.push("/carrito");
              }}
            />
          </>
        ) : (
          <Text style={{ fontFamily: font.body, color: colors.muted, lineHeight: 22 }}>El producto de prueba no está disponible.</Text>
        )}
      </View>
    </Screen>
  );
}
