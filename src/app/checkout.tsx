import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Countdown, GuaranteeNote, PaySheet, useNow } from "../components/fx";
import { useApp } from "../components/provider";
import { Banner, Button, Field, Progress, Screen } from "../components/ui";
import { colors, font } from "../components/theme";
import { readWaOrder, rememberWaOrder } from "../lib/boot";
import { countdownVisible } from "../lib/campaign";
import { countdownTarget, guaranteeFor } from "../lib/cutoff";
import { DEPARTMENTS, districtsFor, provincesFor, shippingZone } from "../lib/zone";
import { paymentsMode, providerFor, type PaymentMethod } from "../lib/env";
import { frameById } from "../lib/catalog";
import { formatSoles } from "../lib/money";
import { quote as priceQuote } from "../lib/pricing";
import { getRepo } from "../lib/repo";
import { rememberReceipt, useCart } from "../lib/store";
import { resolveTaxId } from "../lib/tax-id";
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
    taxId: "",
    taxIdSkipped: false,
    taxLegalName: "",
    recipientName: "",
    recipientPhone: "",
    giftNote: "",
    giftWrap: false,
    otherRecipient: false,
    addressLine: "",
    district: "",
    province: "",
    city: "",
    department: "",
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
  const [taxTouched, setTaxTouched] = useState(false);
  const [pending, setPending] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<"department" | "province" | "district" | null>(null);
  const [query, setQuery] = useState("");

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
        textOverlay: item.textOverlay,
        card: item.card,
        voice: item.voice,
      })),
      ...form,
      city: form.district,
      province: form.province,
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
  const taxCheck = resolveTaxId({ taxId: form.taxId, skipped: form.taxIdSkipped });
  const zone = form.department && form.province && form.district ? shippingZone(form.department, form.province, form.district) : null;
  const guarantee = campaign ? guaranteeFor(now, zone, campaign) : null;
  const provinces = provincesFor(form.department);
  const districts = districtsFor(form.department, form.province);
  const choices = picker === "department" ? DEPARTMENTS : picker === "province" ? provinces : districts;
  const visibleChoices = choices.filter((item) => item.toLowerCase().includes(query.trim().toLowerCase()));

  function openPicker(next: "department" | "province" | "district") {
    setQuery("");
    setPicker(next);
  }

  function choosePlace(item: string) {
    if (picker === "department") setForm({ ...form, department: item, province: "", district: "" });
    else if (picker === "province") setForm({ ...form, province: item, district: "" });
    else setForm({ ...form, district: item, city: item });
    setPicker(null);
  }

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
    const tax = resolveTaxId({ taxId: form.taxId, skipped: form.taxIdSkipped });
    if (!tax.ok) {
      setTaxTouched(true);
      setError(tax.error);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const wa = readWaOrder();
      const order = wa ? await getRepo().updatePendingOrder(wa, input) : await getRepo().placeOrder(input);
      if (order.totalCents === 0) {
        await pay(true, order);
        return;
      }
      if (paymentsMode() === "live" && method !== "plin") {
        const response = await fetch("/api/payments/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: order.id,
            amountCents: order.totalCents,
            method,
            description: order.number,
            payer: {
              name: order.customerName,
              email: order.email,
              phone: order.phone,
              identityType: order.taxIdType,
              identityCode: order.taxId,
            },
          }),
        });
        const payload = (await response.json()) as { checkoutUrl?: string; formToken?: string; publicKey?: string; error?: string };
        if (payload.formToken && payload.publicKey && typeof window !== "undefined") {
          window.sessionStorage.setItem("mifotito-izipay", JSON.stringify({ formToken: payload.formToken, publicKey: payload.publicKey }));
          router.push("/pago");
          return;
        }
        if (payload.checkoutUrl && typeof window !== "undefined") {
          window.location.href = payload.checkoutUrl;
          return;
        }
        setError(payload.error || "No pudimos abrir el pago.");
        return;
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
        {campaign && countdownVisible(now, campaign) ? <Countdown target={countdownTarget(now, zone, campaign)} now={now} /> : null}
        {guarantee ? <GuaranteeNote guarantee={guarantee} /> : null}
        <Field label="Nombre" value={form.customerName} onChangeText={(customerName) => setForm({ ...form, customerName })} />
        <Field label="Celular" keyboardType="phone-pad" placeholder="987 654 321" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} />
        <Field label="Correo" autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="lucia@correo.com" value={form.email} onChangeText={(email) => setForm({ ...form, email })} />
        <View style={{ opacity: form.taxIdSkipped ? 0.45 : 1 }} pointerEvents={form.taxIdSkipped ? "none" : "auto"}>
          <Field
            label="DNI o RUC (para fines tributarios)"
            hint="Lo usamos para emitir tu boleta o factura."
            error={!form.taxIdSkipped && taxTouched && !taxCheck.ok ? taxCheck.error : undefined}
            editable={!form.taxIdSkipped}
            keyboardType="number-pad"
            placeholder="87654321 o 20#########"
            value={form.taxIdSkipped ? "" : form.taxId}
            onChangeText={(taxId) => setForm({ ...form, taxId })}
            onBlur={() => setTaxTouched(true)}
          />
        </View>
        <Pressable
          onPress={() => {
            const next = !form.taxIdSkipped;
            setForm({ ...form, taxIdSkipped: next, taxId: next ? "" : form.taxId, taxLegalName: next ? "" : form.taxLegalName });
            if (next) setTaxTouched(false);
          }}
          style={{ minHeight: 44, justifyContent: "center" }}
        >
          <Text style={{ fontFamily: font.medium, color: colors.ink }}>{form.taxIdSkipped ? "☑" : "☐"} No tengo DNI ni RUC / alguien más está comprando por mí</Text>
        </Pressable>
        {!form.taxIdSkipped && taxCheck.ok && taxCheck.taxIdType === "RUC" ? (
          <Field label="Razón social (opcional)" value={form.taxLegalName} onChangeText={(taxLegalName) => setForm({ ...form, taxLegalName })} />
        ) : null}
        <Pressable onPress={() => openPicker("department")} style={choice}>
          <Text style={choiceLabel}>Departamento</Text>
          <Text style={choiceValue}>{form.department || "Elegir"}</Text>
        </Pressable>
        <Pressable onPress={() => form.department && openPicker("province")} style={[choice, !form.department && { opacity: 0.45 }]}>
          <Text style={choiceLabel}>Provincia</Text>
          <Text style={choiceValue}>{form.province || "Elegir"}</Text>
        </Pressable>
        <Pressable onPress={() => form.province && openPicker("district")} style={[choice, !form.province && { opacity: 0.45 }]}>
          <Text style={choiceLabel}>Distrito</Text>
          <Text style={choiceValue}>{form.district || "Elegir"}</Text>
        </Pressable>
        <Field label="Dirección" value={form.addressLine} onChangeText={(addressLine) => setForm({ ...form, addressLine })} />
        <Field label="Referencia" value={form.reference} onChangeText={(reference) => setForm({ ...form, reference })} />
        <Text style={{ fontFamily: font.semibold, color: zone === "provinces" ? colors.warn : colors.pine }}>
          {zone === "lima" ? "Lima y Callao · 2 a 3 días hábiles" : zone === "provinces" ? "Provincias · 3 a 5 días hábiles" : "Elige departamento, provincia y distrito para ver el plazo."}
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
        <Field label="Tarjeta de regalo" autoCapitalize="characters" value={form.giftCardCode} onChangeText={(giftCardCode) => setForm({ ...form, giftCardCode })} />
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
              <Text style={{ fontFamily: font.semibold, color: method === item ? "white" : colors.ink }}>{item === "card" ? "Tarjeta" : item === "yape" ? "Yape" : "Plin"}</Text>
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
        <Modal visible={picker !== null} animationType="slide" transparent onRequestClose={() => setPicker(null)}>
          <View style={{ flex: 1, backgroundColor: "rgba(36,23,20,0.45)", justifyContent: "flex-end" }}>
            <View style={{ maxHeight: "82%", backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, gap: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={{ fontFamily: font.displaySoft, fontSize: 24, color: colors.ink }}>{picker === "department" ? "Departamento" : picker === "province" ? "Provincia" : "Distrito"}</Text>
                <Pressable onPress={() => setPicker(null)} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}>
                  <Text style={{ fontFamily: font.semibold, color: colors.red }}>Cerrar</Text>
                </Pressable>
              </View>
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Buscar"
                placeholderTextColor="#A89488"
                autoCorrect={false}
                style={{ minHeight: 48, borderRadius: 14, backgroundColor: colors.white, paddingHorizontal: 14, fontFamily: font.body, fontSize: 16, color: colors.ink }}
              />
              <ScrollView keyboardShouldPersistTaps="handled">
                {visibleChoices.map((item) => (
                  <Pressable key={item} onPress={() => choosePlace(item)} style={{ minHeight: 48, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: colors.line }}>
                    <Text style={{ fontFamily: font.medium, fontSize: 16, color: colors.ink }}>{item}</Text>
                  </Pressable>
                ))}
                {!visibleChoices.length ? <Text style={{ fontFamily: font.body, color: colors.muted, paddingVertical: 12 }}>No hay coincidencias.</Text> : null}
              </ScrollView>
            </View>
          </View>
        </Modal>
      </View>
    </Screen>
  );
}

const choice = { minHeight: 52, borderRadius: 14, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, justifyContent: "center" as const, paddingHorizontal: 14 };
const choiceLabel = { fontFamily: font.medium, color: colors.muted, fontSize: 12 };
const choiceValue = { fontFamily: font.semibold, color: colors.ink, fontSize: 16 };
