import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CollageStill } from "../components/CollageBoard";
import { EmptyCart } from "../components/EmptyCart";
import { GiftNoteEditor } from "../components/GiftNoteCard";
import { FrameView } from "../components/FrameView";
import { PriceTicker } from "../components/fx";
import { Button, Card, Progress, Screen, TabBar } from "../components/ui";
import { colors, font } from "../components/theme";
import { cardOrderLine, priceCards } from "../lib/cards";
import { findFrame } from "../lib/catalog";
import { framedPriceCents } from "../lib/collage";
import { formatSoles } from "../lib/money";
import { cartQuoteLines } from "../lib/cart-lines";
import { quote } from "../lib/pricing";
import { EXAMPLE_PHOTO_PROMPT, usesExamplePhoto } from "../lib/example-photo";
import { useCart } from "../lib/store";
import { isTestOnlyCart, isTestProductItem, TEST_PRODUCT_CENTS, TEST_PRODUCT_NAME } from "../lib/test-product";
import { printBorderLabel } from "../lib/print-borders";

export default function Carrito() {
  const items = useCart((state) => (Array.isArray(state.items) ? state.items : []));
  const gift = useCart((state) => state.gift);
  const setGift = useCart((state) => state.setGift);
  const remove = useCart((state) => state.remove);
  const [sampleNote, setSampleNote] = useState<string | null>(null);
  const priced = quote({ items: cartQuoteLines(items) });
  if (!items.length) {
    return (
      <Screen footer={<TabBar />}>
        <EmptyCart />
      </Screen>
    );
  }
  return (
    <Screen
      footer={
        <View>
          <View style={{ padding: 16, gap: 8, backgroundColor: colors.bg }}>
            <PriceTicker cents={priced.totalCents} />
            {sampleNote ? <Text style={{ fontFamily: font.medium, color: colors.bad, textAlign: "center" }}>{sampleNote}</Text> : null}
            <Button label="Continuar al pago" onPress={() => {
              if (items.some((item) => usesExamplePhoto(item))) {
                setSampleNote(EXAMPLE_PHOTO_PROMPT);
                return;
              }
              router.push("/checkout");
            }} />
          </View>
          <TabBar />
        </View>
      }
    >
      <View style={{ padding: 16, gap: 12 }}>
        <Progress step={3} />
        <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Tu carrito</Text>
        {items.map((item) => {
          if (item.card) {
            const price = priceCards(item.card.quantity);
            return (
              <Card key={item.id}>
                <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Tarjeta {item.card.sizeId}</Text>
                <Text style={{ fontFamily: font.body, color: colors.muted }}>{cardOrderLine(item.card)}</Text>
                <Text style={{ fontFamily: font.body, color: colors.muted }}>Incluye sobre blanco C5</Text>
                <Text style={{ fontFamily: font.body, color: colors.muted }}>{item.card.frontMessage?.text || "Sin mensaje de portada"}</Text>
                <Text style={{ fontFamily: font.body, color: colors.muted }}>{item.card.insideMessage?.text || "Sin mensaje interior"}</Text>
                <Text style={{ fontFamily: font.bold, color: colors.ink }}>{formatSoles(price.cents)}</Text>
                <Pressable onPress={() => remove(item.id)} style={{ minHeight: 44, justifyContent: "center" }}>
                  <Text style={{ fontFamily: font.semibold, color: colors.bad }}>Quitar</Text>
                </Pressable>
              </Card>
            );
          }
          if (isTestProductItem(item)) {
            return (
              <Card key={item.id}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{TEST_PRODUCT_NAME}</Text>
                  <Text style={{ fontFamily: font.body, color: colors.muted }}>No entra a producción. El envío es S/ 0.</Text>
                  <Text style={{ fontFamily: font.bold, color: colors.ink }}>{formatSoles(TEST_PRODUCT_CENTS)}</Text>
                </View>
                <Pressable onPress={() => remove(item.id)} style={{ minHeight: 44, justifyContent: "center" }}>
                  <Text style={{ fontFamily: font.semibold, color: colors.bad }}>Quitar</Text>
                </Pressable>
              </Card>
            );
          }
          const frame = findFrame(item.frameId);
          if (!frame) {
            return (
              <Card key={item.id}>
                <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Este artículo ya no está disponible</Text>
                <Text style={{ fontFamily: font.body, color: colors.muted }}>Quítalo del carrito para continuar.</Text>
                <Pressable onPress={() => remove(item.id)} style={{ minHeight: 44, justifyContent: "center" }}>
                  <Text style={{ fontFamily: font.semibold, color: colors.bad }}>Quitar</Text>
                </Pressable>
              </Card>
            );
          }
          const price = framedPriceCents(frame.priceCents, Boolean(item.collage));
          return (
            <Card key={item.id}>
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <FrameView
                  frame={frame}
                  photoId={item.collage ? undefined : item.photoId}
                  crop={item.collage ? undefined : item.crop}
                  orientation={item.orientation}
                  width={78}
                  overlay={item.collage ? undefined : item.textOverlay}
                  printBorder={item.collage ? null : item.printBorder}
                  opening={item.collage ? <CollageStill photoId={item.photoId} /> : undefined}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{frame.name}</Text>
                  <Text style={{ fontFamily: font.body, color: colors.muted }}>{item.collage ? `Collage · ${item.collage.templateName}` : frame.sizeLabel}</Text>
                  {item.bundleLabel ? <Text style={{ fontFamily: font.medium, color: colors.pine }}>{item.bundleLabel}</Text> : null}
                  {!item.collage && printBorderLabel(item.printBorder) ? <Text testID="carrito-borde" style={{ fontFamily: font.medium, color: colors.pine }}>{printBorderLabel(item.printBorder)} · sin costo</Text> : null}
                  <Text style={{ fontFamily: font.bold, color: colors.ink }}>{formatSoles(price)}</Text>
                </View>
              </View>
              <Pressable onPress={() => remove(item.id)} style={{ minHeight: 44, justifyContent: "center" }}>
                <Text style={{ fontFamily: font.semibold, color: colors.bad }}>Quitar</Text>
              </Pressable>
            </Card>
          );
        })}
        {isTestOnlyCart(items) ? null : <GiftNoteEditor
          printed={gift.isGift}
          to={gift.to}
          message={gift.message}
          fromName={gift.from}
          buyerName=""
          hidePrices={gift.hidePrices}
          onChange={(next) => setGift({ isGift: next.printed, to: next.to, message: next.message, from: next.fromName, hidePrices: next.hidePrices })}
        />}
        {isTestOnlyCart(items) ? null : priced.frameDiscountLabel ? (
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

/** Expo Router shows this instead of a blank page if the cart screen throws, for example on stale cart data. */
export function ErrorBoundary({ retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <Screen footer={<TabBar />}>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontFamily: font.display, fontSize: 28, color: colors.ink }}>No pudimos abrir el carrito</Text>
        <Text style={{ fontFamily: font.body, color: colors.muted }}>
          Algo en tu carrito no cargó bien. Prueba de nuevo, o vacía el carrito y empieza de nuevo. Si sigue igual, escríbenos a pedidos@mifotito.com.
        </Text>
        <Button label="Reintentar" onPress={() => void retry()} />
        <Button
          label="Vaciar carrito y empezar de nuevo"
          onPress={() => {
            useCart.getState().clear();
            router.replace("/");
          }}
        />
      </View>
    </Screen>
  );
}
