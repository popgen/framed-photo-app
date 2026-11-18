import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Countdown, GuaranteeNote, PaySheet, useNow } from "../components/fx";
import { useApp } from "../components/provider";
import { Banner, Button, Field, Progress, Screen } from "../components/ui";
import { colors, font } from "../components/theme";
import { readWaOrder, rememberWaOrder } from "../lib/boot";
import { motionEnabled } from "../lib/campaign";
import { countdownTarget, guaranteeFor } from "../lib/cutoff";
import { DEPARTMENTS, districtsFor, shippingZone } from "../lib/zone";
import { paymentsMode, providerFor, type PaymentMethod } from "../lib/env";
import { frameById } from "../lib/catalog";
import { formatSoles } from "../lib/money";
import { quote as priceQuote } from "../lib/pricing";
import { getRepo } from "../lib/repo";
import { rememberReceipt, useCart } from "../lib/store";
import type { CheckoutInput, Order } from "../lib/types";

export default function Checkout() {
  const now = useNow();
  const params = useLocalSearchParams<{ pago?: string }>();
  const items = useCart((state) => state.items);
  const clear = useCart((state) => state.clear);
  const { refresh } = useApp();
  const [campaign, setCampaign] = useState<Awaited<ReturnType<ReturnType<typeof getRepo>["getCampaign"]>> | null>(null);
  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    email: "",
    recipientName: "",
    recipientPhone: "",
    giftNote: "",
    giftWrap: false,
    otherRecipient: false,
    addressLine: "",
    district: "",
    city: "",
    department: "Lima",
    reference: "",
    promoCode: "",
    referralCode: "",
    giftCardCode: "",
    useCredit: false,
    ackLowRes: false,
  });
  const [method, setMethod] = useState<PaymentMethod>(params.pago === "plin" || params.pago === "card" ? params.pago : "yape");
  const [quote, setQuote] = useState<Awaited<ReturnType<ReturnType<typeof getRepo>["quoteCheckout"]>> | null>(null);
  const [credit, setCredit] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<"department" | "district" | null>(null);

  useEffect(() => {
    void getRepo().getCampaign().then(setCampaign);
  }, []);

  const input = useMemo<CheckoutInput>(
    () => ({
      items: items.map((item) => ({
        frameId: item.frameId,
        photoId: item.photoId,
        crop: item.crop,
        orientation: item.orientation,
        dpi: item.dpi,
        resolutionStatus: item.resolutionStatus,
        bundleId: item.bundleId,
        bundleLabel: item.bundleLabel,
      })),
      ...form,
      city: form.city || form.district,
      paymentMethod: method,
      channel: readWaOrder() ? "whatsapp" : "web",
    }),
    [form, items, method],
  );

  useEffect(() => {
    const phone = form.phone;
    const handle = setTimeout(() => {
      void getRepo().quoteCheckout(input).then(setQuote);
      void getRepo().creditBalance(phone).then(setCredit);
    }, 200);
    return () => clearTimeout(handle);
  }, [input, form.phone]);

  const instant = priceQuote({
    items: items.map((item) => ({ unitPriceCents: frameById(item.frameId).priceCents })),
    giftWrap: form.giftWrap,
  });
  const shownTotal = quote?.totalCents ?? instant.totalCents;
  const zone = form.department ? shippingZone(form.department, form.district) : null;
  const guarantee = campaign ? guaranteeFor(now, zone, campaign) : null;
  const districts = districtsFor(form.department);

  async function pay(approved: boolean, order = pending) {
    if (!approved || !order) {
      setPending(null);
      if (!approved) setError("El pago no se completó. Puedes intentarlo otra vez.");
      return;
    }
    setBusy(true);
    try {
      const paid = await getRepo().markPaid(order.id, {
        method: order.totalCents === 0 ? "gift_card" : method,
        provider: providerFor(method, paymentsMode()),
        ref: `${providerFor(method, paymentsMode())}_${order.id.slice(0, 8)}`,
      });
      rememberReceipt(paid);
      clear();
      rememberWaOrder(null);
      refresh();
      router.replace(`/confirmacion/${paid.publicToken}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos confirmar el pago.");
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  async function start() {
    setError(null);
    setBusy(true);
    try {
      const wa = readWaOrder();
      const order = wa ? await getRepo().updatePendingOrder(wa, input) : await getRepo().placeOrder(input);
      if (order.totalCents === 0) {
        await pay(true, order);
        return;
      }
      if (paymentsMode() === "live") {
        const response = await fetch("/api/payments/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id, amountCents: order.totalCents, method, description: order.number, payer: { name: order.customerName, email: order.email, phone: order.phone } }),
        });
        const payload = (await response.json()) as { checkoutUrl?: string; status?: string };
        if (payload.checkoutUrl && typeof window !== "undefined") {
          window.location.href = payload.checkoutUrl;
          return;
        }
      }
      setPending(order);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Revisa los datos.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      seasonal={null}
      footer={
        <View style={{ padding: 16, gap: 8, backgroundColor: colors.bg }}>
          <Text style={{ fontFamily: font.display, fontSize: 28, color: colors.ink }}>{formatSoles(shownTotal)}</Text>
          <Button label={busy ? "Procesando…" : "Pagar"} disabled={busy || !items.length} onPress={() => void start()} />
        </View>
      }
    >
      <View style={{ padding: 16, gap: 12 }}>
        <Progress step={3} />
        <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Entrega</Text>
        {campaign && motionEnabled(campaign) ? <Countdown target={countdownTarget(now, zone, campaign)} now={now} /> : null}
        {guarantee ? <GuaranteeNote guarantee={guarantee} /> : null}
        <Field label="Nombre" value={form.customerName} onChangeText={(customerName) => setForm({ ...form, customerName })} />
        <Field label="Celular" keyboardType="phone-pad" placeholder="987 654 321" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} />
        <Field label="Correo (opcional)" autoCapitalize="none" value={form.email} onChangeText={(email) => setForm({ ...form, email })} />
        <Pressable onPress={() => setPicker("department")} style={choice}>
          <Text style={choiceLabel}>Departamento</Text>
          <Text style={choiceValue}>{form.department || "Elegir"}</Text>
        </Pressable>
        {districts.length ? (
          <Pressable onPress={() => setPicker("district")} style={choice}>
            <Text style={choiceLabel}>Distrito</Text>
            <Text style={choiceValue}>{form.district || "Elegir"}</Text>
          </Pressable>
        ) : (
          <Field label="Distrito o ciudad" value={form.district} onChangeText={(district) => setForm({ ...form, district })} />
        )}
        <Field label="Dirección" value={form.addressLine} onChangeText={(addressLine) => setForm({ ...form, addressLine })} />
        <Field label="Referencia" value={form.reference} onChangeText={(reference) => setForm({ ...form, reference })} />
        <Text style={{ fontFamily: font.semibold, color: zone === "provinces" ? colors.warn : colors.pine }}>
          {zone === "provinces" ? "Provincias · 3 a 5 días hábiles" : "Lima y Callao · 2 a 3 días hábiles"}
        </Text>
        <Pressable onPress={() => setForm({ ...form, otherRecipient: !form.otherRecipient })} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ fontFamily: font.medium, color: colors.ink }}>{form.otherRecipient ? "☑" : "☐"} Se lo envío a otra persona</Text>
        </Pressable>
        {form.otherRecipient ? (
          <>
            <Field label="Nombre de quien lo recibe" value={form.recipientName} onChangeText={(recipientName) => setForm({ ...form, recipientName })} />
            <Field label="Celular de quien lo recibe" value={form.recipientPhone} onChangeText={(recipientPhone) => setForm({ ...form, recipientPhone })} />
          </>
        ) : null}
        <Field label="Nota de regalo" value={form.giftNote} onChangeText={(giftNote) => setForm({ ...form, giftNote })} />
        <Pressable onPress={() => setForm({ ...form, giftWrap: !form.giftWrap })} style={{ minHeight: 52, justifyContent: "center", backgroundColor: form.giftWrap ? "#E7F6EE" : colors.white, borderRadius: 16, padding: 12 }}>
          <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{form.giftWrap ? "☑" : "☐"} {campaign?.giftWrapTitle ?? "Envoltorio de regalo"} · S/ 10</Text>
          <Text style={{ fontFamily: font.body, color: colors.muted }}>{campaign?.giftWrapBody ?? "La caja va sin precios."}</Text>
        </Pressable>
        <Field label="Código promo" autoCapitalize="characters" value={form.promoCode} onChangeText={(promoCode) => setForm({ ...form, promoCode })} />
        <Field label="Código de amigo" autoCapitalize="characters" value={form.referralCode} onChangeText={(referralCode) => setForm({ ...form, referralCode })} />
        <Field label="Gift card" autoCapitalize="characters" value={form.giftCardCode} onChangeText={(giftCardCode) => setForm({ ...form, giftCardCode })} />
        {credit > 0 ? (
          <Pressable onPress={() => setForm({ ...form, useCredit: !form.useCredit })} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ fontFamily: font.medium, color: colors.ink }}>{form.useCredit ? "☑" : "☐"} Usar mi saldo {formatSoles(credit)}</Text>
          </Pressable>
        ) : null}
        {items.some((item) => item.resolutionStatus === "low") ? (
          <Pressable onPress={() => setForm({ ...form, ackLowRes: !form.ackLowRes })} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ fontFamily: font.medium, color: colors.ink }}>{form.ackLowRes ? "☑" : "☐"} Acepto imprimir una foto de resolución baja</Text>
          </Pressable>
        ) : null}
        <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Pago</Text>
        <View style={{ gap: 8 }}>
          {(["yape", "plin", "card"] as const).map((item) => (
            <Pressable key={item} onPress={() => setMethod(item)} style={{ minHeight: 52, borderRadius: 16, padding: 12, justifyContent: "center", backgroundColor: method === item ? colors.ink : colors.white }}>
              <Text style={{ fontFamily: font.semibold, color: method === item ? "white" : colors.ink }}>{item === "card" ? "Tarjeta · Mercado Pago" : item === "yape" ? "Yape" : "Plin"}</Text>
            </Pressable>
          ))}
        </View>
        {quote?.promoError ? <Banner tone="bad" text={quote.promoError} /> : null}
        {quote?.referralError ? <Banner tone="bad" text={quote.referralError} /> : null}
        {quote?.giftCardError ? <Banner tone="bad" text={quote.giftCardError} /> : null}
        {quote?.stockError ? <Banner tone="bad" text={quote.stockError} /> : null}
        {quote?.frameDiscountCents ? <Text style={{ fontFamily: font.medium, color: colors.pine }}>{quote.frameDiscountLabel}: -{formatSoles(quote.frameDiscountCents)}</Text> : null}
        {error ? <Banner tone="bad" text={error} /> : null}
        {pending && pending.totalCents > 0 ? <PaySheet method={method} total={formatSoles(pending.totalCents)} onApprove={() => void pay(true)} onReject={() => void pay(false)} /> : null}
        {picker ? (
          <View style={{ backgroundColor: colors.card, borderRadius: 18, maxHeight: 320 }}>
            <Text style={{ fontFamily: font.semibold, padding: 12 }}>{picker === "department" ? "Departamento" : "Distrito"}</Text>
            {(picker === "department" ? DEPARTMENTS : districts).map((item) => (
              <Pressable
                key={item}
                onPress={() => {
                  if (picker === "department") setForm({ ...form, department: item, district: "" });
                  else setForm({ ...form, district: item, city: form.department === "Lima" || form.department === "Callao" ? "Lima" : item });
                  setPicker(null);
                }}
                style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 12 }}
              >
                <Text style={{ fontFamily: font.medium, color: colors.ink }}>{item}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const choice = { minHeight: 52, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, justifyContent: "center" as const, paddingHorizontal: 14 };
const choiceLabel = { fontFamily: font.medium, color: colors.muted, fontSize: 12 };
const choiceValue = { fontFamily: font.semibold, color: colors.ink, fontSize: 16 };
