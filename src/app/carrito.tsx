import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { CollageStill } from "../components/CollageBoard";
import { GiftNoteEditor } from "../components/GiftNoteCard";
import { FrameView } from "../components/FrameView";
import { PriceTicker } from "../components/fx";
import { Button, Card, Progress, Screen, TabBar } from "../components/ui";
import { colors, font } from "../components/theme";
import { cardOrderLine, priceCards } from "../lib/cards";
import { frameById } from "../lib/catalog";
import { framedPriceCents } from "../lib/collage";
import { formatSoles } from "../lib/money";
import { quote, type QuoteItem } from "../lib/pricing";
import { VOICE_ADDON_CENTS } from "../lib/voice";
import { EXAMPLE_PHOTO_PROMPT, usesExamplePhoto } from "../lib/example-photo";
import { useCart } from "../lib/store";
import { isTestOnlyCart, isTestProductItem, TEST_PRODUCT_CENTS, TEST_PRODUCT_NAME } from "../lib/test-product";

export default function Carrito() {
  const items = useCart((state) => state.items);
  const gift = useCart((state) => state.gift);
  const setGift = useCart((state) => state.setGift);
  const remove = useCart((state) => state.remove);
  const [sampleNote, setSampleNote] = useState<string | null>(null);
  const priced = quote({
    items: items.flatMap((item): QuoteItem[] => {
      if (isTestProductItem(item)) return [{ unitPriceCents: TEST_PRODUCT_CENTS, quantity: 1, kind: "plain" }];
      const lines: QuoteItem[] = item.card
        ? [{ unitPriceCents: priceCards(item.card.quantity).cents, quantity: 1, kind: "plain" }]
        : [{ unitPriceCents: framedPriceCents(frameById(item.frameId).priceCents, Boolean(item.collage)), quantity: 1, kind: "frame" }];
      if (item.voice) lines.push({ unitPriceCents: item.voice.addonCents || VOICE_ADDON_CENTS, quantity: 1, kind: "plain" });
      return lines;
    }),
  });
  return (
    <Screen
      footer={
        <View>
          <View style={{ padding: 16, gap: 8, backgroundColor: colors.bg }}>
            <PriceTicker cents={priced.totalCents} />
            {sampleNote ? <Text style={{ fontFamily: font.medium, color: colors.bad, textAlign: "center" }}>{sampleNote}</Text> : null}
            <Button label="Continuar al pago" disabled={!items.length} onPress={() => {
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
        {!items.length ? <Text style={{ fontFamily: font.body, color: colors.muted }}>Todavía no hay marcos. Arma el primero.</Text> : null}
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
          const frame = frameById(item.frameId);
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
                  opening={item.collage ? <CollageStill photoId={item.photoId} /> : undefined}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{frame.name}</Text>
                  <Text style={{ fontFamily: font.body, color: colors.muted }}>{item.collage ? `Collage · ${item.collage.templateName}` : frame.sizeLabel}</Text>
                  {item.bundleLabel ? <Text style={{ fontFamily: font.medium, color: colors.pine }}>{item.bundleLabel}</Text> : null}
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
