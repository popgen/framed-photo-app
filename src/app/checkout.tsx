import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { InlineLink } from "../components/InlineLink";
import { currentCustomer, passwordError, type CustomerSession } from "../lib/customer-auth";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Countdown, GuaranteeNote, PaySheet, useNow } from "../components/fx";
import { useApp } from "../components/provider";
import { GiftNoteEditor } from "../components/GiftNoteCard";
import { DiscountCodeField } from "../components/DiscountCodeField";
import { Banner, Button, Field, Progress, Screen } from "../components/ui";
import { colors, font } from "../components/theme";
import { readWaOrder, rememberWaOrder } from "../lib/boot";
import { countdownVisible } from "../lib/campaign";
import { countdownTarget, guaranteeFor } from "../lib/cutoff";
import { DEPARTMENTS, districtsFor, provincesFor, shippingZone } from "../lib/zone";
import { dataMode, paymentsMode, providerFor, type PaymentMethod } from "../lib/env";
import { cardOrderLine } from "../lib/cards";
import { frameById } from "../lib/catalog";
import { framedPriceCents } from "../lib/collage";
import { formatSoles } from "../lib/money";
import { GIFT_NOTE_MESSAGE_MAX } from "../lib/gift-note";
import { quote as priceQuote } from "../lib/pricing";
import { getRepo } from "../lib/repo";
import { EXAMPLE_PHOTO_PROMPT, usesExamplePhoto } from "../lib/example-photo";
import { rememberReceipt, useCart } from "../lib/store";
import { resolveTaxId } from "../lib/tax-id";
import type { CheckoutInput, Order } from "../lib/types";

export default function Checkout() {
  const now = useNow();
  const params = useLocalSearchParams<{ pago?: string }>();
  const items = useCart((state) => state.items);
  const setGift = useCart((state) => state.setGift);
  const clear = useCart((state) => state.clear);
  const savedGift = useCart.getState().gift;
  const { refresh } = useApp();
  const [campaign, setCampaign] = useState<Awaited<ReturnType<ReturnType<typeof getRepo>["getCampaign"]>> | null>(null);
  const [account, setAccount] = useState<CustomerSession | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [payToken, setPayToken] = useState<string | null>(null);
  const [form, setForm] = useState({
    customerName: "",
    phone: "",
    email: "",
    taxId: "",
    taxIdSkipped: false,
    taxLegalName: "",
    recipientName: "",
    recipientPhone: "",
    giftPrinted: savedGift.isGift,
    giftNoteTo: savedGift.to,
    giftNoteMessage: savedGift.message,
    giftNoteFrom: savedGift.from,
    hidePrices: savedGift.hidePrices,
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
  const [mercadoPago, setMercadoPago] = useState(false);
  const [quote, setQuote] = useState<Awaited<ReturnType<ReturnType<typeof getRepo>["quoteCheckout"]>> | null>(null);
  const [credit, setCredit] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [taxTouched, setTaxTouched] = useState(false);
  const [pending, setPending] = useState<Order | null>(null);
  const [busy, setBusy] = useState(false);
  const [picker, setPicker] = useState<"department" | "province" | "district" | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let stopped = false;
    void fetch("/api/payments/methods")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { mercadopago?: boolean } | null) => {
        if (stopped || !data?.mercadopago) return;
        setMercadoPago(true);
        if (params.pago === "mercadopago") setMethod("mercadopago");
      })
      .catch(() => undefined);
    return () => {
      stopped = true;
    };
  }, [params.pago]);

  useEffect(() => {
    void getRepo().getCampaign().then(setCampaign);
    void currentCustomer().then((session) => {
      setAccount(session);
      if (session) setForm((current) => ({ ...current, email: current.email || session.email }));
    });
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
        collage: item.collage,
      })),
      ...form,
      isGift: form.giftPrinted,
      giftNote: form.giftNoteMessage,
      hidePrices: form.hidePrices || form.giftWrap,
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
    items: items.map((item) => ({ unitPriceCents: item.collage ? framedPriceCents(frameById(item.frameId).priceCents, true) : frameById(item.frameId).priceCents })),
    giftWrap: form.giftWrap,
    giftNote: form.giftPrinted && form.giftNoteMessage.trim().length > 0 && form.giftNoteMessage.trim().length <= GIFT_NOTE_MESSAGE_MAX,
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

  function finishPaid(order: Order) {
    rememberReceipt(order);
    clear();
    rememberWaOrder(null);
    refresh();
    router.replace(`/confirmacion/${order.publicToken}`);
  }

  async function pay(approved: boolean, order = pending) {
    if (!approved || !order) {
      setPending(null);
      setPayToken(null);
      if (!approved) setError("El pago no se completó. Puedes intentarlo otra vez.");
      return;
    }
    setBusy(true);
    try {
      if (order.paymentStatus === "approved") {
        finishPaid(order);
        return;
      }
      if (payToken) {
        const response = await fetch("/api/payments/mock-confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: payToken, outcome: "approved" }),
        });
        const payload = (await response.json()) as { ok?: boolean; error?: string; order?: Order };
        if (!response.ok || !payload.ok) {
          setError(payload.error || "El pago fue rechazado. Puedes intentar otra vez.");
          return;
        }
        finishPaid({ ...(payload.order || order), accountNotice: payload.order?.accountNotice || order.accountNotice, paymentStatus: "approved", status: "paid" });
        return;
      }
      if (dataMode() === "supabase") {
        setError("El pago se confirma cuando la pasarela lo verifica. Puedes intentar otra vez.");
        return;
      }
      const paid = await getRepo().markPaid(order.id, {
        method: order.totalCents === 0 ? "gift_card" : method,
        provider: providerFor(method, paymentsMode()),
        ref: `${providerFor(method, paymentsMode())}_${order.id.slice(0, 8)}`,
      });
      finishPaid({ ...paid, accountNotice: paid.accountNotice || order.accountNotice });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos confirmar el pago.");
    } finally {
      setBusy(false);
      setPending(null);
      setPayToken(null);
    }
  }

  async function start() {
    if (items.some((item) => usesExamplePhoto(item))) {
      setError(EXAMPLE_PHOTO_PROMPT);
      return;
    }
    const tax = resolveTaxId({ taxId: form.taxId, skipped: form.taxIdSkipped });
    if (!tax.ok) {
      setTaxTouched(true);
      setError(tax.error);
      return;
    }
    if (!account) {
      const problem = passwordError(password);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setError(null);
    setBusy(true);
    try {
      const wa = readWaOrder();
      const orderInput = { ...input, password: account ? undefined : password };
      const order = wa ? await getRepo().updatePendingOrder(wa, orderInput) : await getRepo().placeOrder(orderInput);
      if (order.paymentStatus === "approved" || order.totalCents === 0) {
        if (order.paymentStatus === "approved") {
          finishPaid(order);
          return;
        }
        await pay(true, order);
        return;
      }
      if (method === "mercadopago") {
        const response = await fetch("/api/payments/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id, method }),
        });
        const payload = (await response.json()) as { checkoutUrl?: string; error?: string };
        if (payload.checkoutUrl && typeof window !== "undefined") {
          rememberReceipt(order);
          window.location.href = payload.checkoutUrl;
          return;
        }
        setError(payload.error || "No pudimos abrir Mercado Pago.");
        return;
      }
      if (dataMode() === "supabase" && method !== "plin") {
        const response = await fetch("/api/payments/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id, method }),
        });
        const payload = (await response.json()) as { checkoutUrl?: string; formToken?: string; publicKey?: string; error?: string; token?: string; mock?: boolean; instructions?: string; method?: "card" | "yape"; yapeFallback?: boolean };
        if (payload.formToken && payload.publicKey && typeof window !== "undefined") {
          window.sessionStorage.setItem("mifotito-izipay", JSON.stringify({ formToken: payload.formToken, publicKey: payload.publicKey, method: payload.method || method, yapeFallback: Boolean(payload.yapeFallback) }));
          rememberReceipt(order);
          router.push("/pago");
          return;
        }
        if (payload.checkoutUrl && typeof window !== "undefined") {
          rememberReceipt(order);
          window.location.href = payload.checkoutUrl;
          return;
        }
        if (payload.mock && payload.token) {
          rememberReceipt(order);
          setPayToken(payload.token);
          setPending(order);
          return;
        }
        setError(payload.error || "No pudimos abrir el pago.");
        return;
      }
      if (dataMode() === "supabase" && method === "plin" && paymentsMode() === "live") {
        const response = await fetch("/api/payments/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: order.id, method }),
        });
        const payload = (await response.json()) as { instructions?: string; error?: string };
        setError(payload.instructions || payload.error || "Te escribimos cuando confirmemos el Plin.");
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
          <Text style={{ fontFamily: font.body, color: colors.muted, textAlign: "center", lineHeight: 20 }}>
            Al pagar aceptas los <InlineLink href="/terminos">Términos y condiciones</InlineLink> y la <InlineLink href="/privacidad">Política de privacidad</InlineLink>.
          </Text>
          <Text style={{ fontFamily: font.display, fontSize: 28, color: colors.ink }}>{formatSoles(shownTotal)}</Text>
          <Button label={busy ? "Procesando…" : "Pagar"} disabled={busy || !items.length} onPress={() => void start()} />
        </View>
      }
    >
      <View style={{ padding: 16, gap: 12 }}>
        <Progress step={3} />
        <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Entrega</Text>
        {items.filter((item) => item.card).map((item) => (
          <Text key={item.id} style={{ fontFamily: font.body, color: colors.muted }}>
            Tarjeta {item.card?.sizeId}: {item.card ? cardOrderLine(item.card) : ""} Foto en la portada y mensaje adentro. Incluye sobre blanco C5. El reverso lleva la marca Mi Fotito.
          </Text>
        ))}
        {campaign && countdownVisible(now, campaign) ? <Countdown target={countdownTarget(now, zone, campaign)} now={now} /> : null}
        {guarantee ? <GuaranteeNote guarantee={guarantee} /> : null}
        <Field label="Nombre" value={form.customerName} onChangeText={(customerName) => setForm({ ...form, customerName })} />
        <Field label="Celular" keyboardType="phone-pad" placeholder="987 654 321" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} />
        <Field label="Correo" autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="lucia@correo.com" value={form.email} onChangeText={(email) => setForm({ ...form, email })} />
        {account ? null : (
          <>
            <Field
              label="Contraseña"
              hint="Crea una contraseña para seguir tu pedido. Si ya tienes cuenta, usa la misma."
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
            />
            <Pressable onPress={() => setShowPassword((value) => !value)} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}</Text>
            </Pressable>
          </>
        )}
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
        {form.giftPrinted ? <Text style={{ fontFamily: font.body, color: colors.muted }}>Si el regalo va a otra dirección, márcalo aquí.</Text> : null}
        <Pressable onPress={() => setForm({ ...form, otherRecipient: !form.otherRecipient })} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ fontFamily: font.medium, color: colors.ink }}>{form.otherRecipient ? "☑" : "☐"} Se lo envío a otra persona</Text>
        </Pressable>
        {form.otherRecipient ? (
          <>
            <Field label="Nombre de quien lo recibe" value={form.recipientName} onChangeText={(recipientName) => setForm({ ...form, recipientName })} />
            <Field label="Celular de quien lo recibe" value={form.recipientPhone} onChangeText={(recipientPhone) => setForm({ ...form, recipientPhone })} />
          </>
        ) : null}
        <GiftNoteEditor
          printed={form.giftPrinted}
          to={form.giftNoteTo}
          message={form.giftNoteMessage}
          fromName={form.giftNoteFrom}
          buyerName={form.customerName}
          hidePrices={form.hidePrices || form.giftWrap}
          onChange={(next) => {
            setGift({ isGift: next.printed, to: next.to, message: next.message, from: next.fromName, hidePrices: next.hidePrices });
            setForm({ ...form, giftPrinted: next.printed, giftNoteTo: next.to, giftNoteMessage: next.message, giftNoteFrom: next.fromName, hidePrices: next.hidePrices });
          }}
        />
        {form.giftPrinted && !form.giftWrap ? <Text style={{ fontFamily: font.body, color: colors.muted }}>Si quieres, suma el envoltorio. Va aparte de la nota.</Text> : null}
        <Pressable onPress={() => setForm({ ...form, giftWrap: !form.giftWrap })} style={{ minHeight: 52, justifyContent: "center", backgroundColor: form.giftWrap ? "#E7F6EE" : colors.white, borderRadius: 16, padding: 12, gap: 4 }}>
          <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{form.giftWrap ? "☑" : "☐"} {campaign?.giftWrapTitle ?? "Envoltorio de regalo"} · S/ 10</Text>
          <Text style={{ fontFamily: font.body, color: colors.muted }}>{campaign?.giftWrapBody ?? "La caja va sin precios."}</Text>
          {form.giftWrap ? <Text style={{ fontFamily: font.medium, color: colors.ink }}>☑ No incluir precios en la caja</Text> : null}
        </Pressable>
        <DiscountCodeField
          promoCode={form.promoCode}
          referralCode={form.referralCode}
          giftCardCode={form.giftCardCode}
          phone={form.phone}
          giftAppliedCents={quote?.giftCardAppliedCents}
          onChange={(codes) => setForm((current) => ({ ...current, ...codes }))}
        />
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
          {([
            { id: "yape" as const, label: "Yape" },
            { id: "plin" as const, label: "Plin" },
            { id: "card" as const, label: "Tarjeta" },
            ...(mercadoPago ? [{ id: "mercadopago" as const, label: "Mercado Pago (cuotas, saldo o PagoEfectivo)" }] : []),
          ]).map((item) => (
            <Pressable key={item.id} onPress={() => setMethod(item.id)} style={{ minHeight: item.id === "mercadopago" ? 64 : 52, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 12, justifyContent: "center", backgroundColor: method === item.id ? colors.ink : colors.white }}>
              <Text style={{ fontFamily: font.semibold, color: method === item.id ? "white" : colors.ink, fontSize: item.id === "mercadopago" ? 15 : 16, lineHeight: 22 }}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
        {method === "mercadopago" ? (
          <Text style={{ fontFamily: font.body, color: colors.muted, lineHeight: 20 }}>
            Te llevamos a Mercado Pago. Puedes pagar con tarjeta en cuotas, con tu saldo o con PagoEfectivo. El pedido sigue pendiente hasta que Mercado Pago confirme el pago.
          </Text>
        ) : null}
        {quote?.promoError ? <Banner tone="bad" text={quote.promoError} /> : null}
        {quote?.referralError ? <Banner tone="bad" text={quote.referralError} /> : null}
        {quote?.giftCardError ? <Banner tone="bad" text={quote.giftCardError} /> : null}
        {quote?.stockError ? <Banner tone="bad" text={quote.stockError} /> : null}
        {quote?.frameDiscountCents ? <Text style={{ fontFamily: font.medium, color: colors.pine }}>{quote.frameDiscountLabel}: -{formatSoles(quote.frameDiscountCents)}</Text> : null}
        {quote?.promoDiscountCents ? <Text style={{ fontFamily: font.medium, color: colors.pine }}>Código promocional: -{formatSoles(quote.promoDiscountCents)}</Text> : null}
        {quote?.referralDiscountCents ? <Text style={{ fontFamily: font.medium, color: colors.pine }}>Código de amigo: -{formatSoles(quote.referralDiscountCents)}</Text> : null}
        {quote?.giftCardAppliedCents ? <Text style={{ fontFamily: font.medium, color: colors.pine }}>Tarjeta de regalo: -{formatSoles(quote.giftCardAppliedCents)}</Text> : null}
        {error ? <Banner tone="bad" text={error} /> : null}
        {pending && pending.totalCents > 0 && method !== "mercadopago" ? <PaySheet method={method} total={formatSoles(pending.totalCents)} onApprove={() => void pay(true)} onReject={() => void pay(false)} /> : null}
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
