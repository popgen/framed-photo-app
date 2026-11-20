import { router, useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
import { InlineLink } from "../components/InlineLink";
import { currentCustomer, passwordError, type CustomerSession } from "../lib/customer-auth";
import { Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Collapsible } from "../components/Collapsible";
import { Countdown, GuaranteeNote, PaySheet, useNow, useReducedMotion } from "../components/fx";
import { useApp } from "../components/provider";
import { GiftNoteEditor } from "../components/GiftNoteCard";
import { DiscountCodeField } from "../components/DiscountCodeField";
import { Banner, Button, Field, Progress, Screen } from "../components/ui";
import { colors, font } from "../components/theme";
import { readWaOrder, rememberWaOrder } from "../lib/boot";
import { countdownVisible } from "../lib/campaign";
import {
  afterContinue,
  afterSkip,
  checkoutFieldId,
  checkoutHeaderId,
  focusCheckoutField,
  focusForCheckoutError,
  initialAcknowledged,
  initialOpenSection,
  mergeCheckoutProfile,
  payBlockAfterAccount,
  sectionBadge,
  toggleCheckoutSection,
  type CheckoutField,
  type CheckoutSection,
} from "../lib/checkout-sections";
import { countdownTarget, guaranteeFor } from "../lib/cutoff";
import { DEPARTMENTS, districtsFor, provincesFor, shippingZone } from "../lib/zone";
import { checkoutPayMethodForSubmit, checkoutPayOptions, resolveCheckoutPayMethod, type CheckoutPayMethod } from "../lib/checkout-payment";
import { DONATION_CENTS, donationCheckboxLabel, donationSummaryText } from "../lib/donation";
import { dataMode, paymentsMode, providerFor } from "../lib/env";
import { isTestOnlyCart, isTestProductItem, TEST_PRODUCT_CENTS } from "../lib/test-product";
import { cardMessageError, cardOrderLine } from "../lib/cards";
import { revealHeader } from "../lib/editor-sections";
import { frameById } from "../lib/catalog";
import { framedPriceCents } from "../lib/collage";
import { formatSoles } from "../lib/money";
import { GIFT_NOTE_MESSAGE_MAX } from "../lib/gift-note";
import { quote as priceQuote } from "../lib/pricing";
import { getRepo } from "../lib/repo";
import { EXAMPLE_PHOTO_PROMPT, usesExamplePhoto } from "../lib/example-photo";
import {
  checkoutPageShowReset,
  findSessionPendingMercadoPago,
  PENDING_MP_NOTE,
  placeCheckoutOrder,
  readOrderPaymentStatus,
  type SessionPendingOrder,
} from "../lib/checkout-payment";
import {
  cartPendingKey,
  clearCheckoutDraft,
  clearPendingMercadoPago,
  readCheckoutDraft,
  readPendingMercadoPago,
  readReceipt,
  rememberCheckoutDraft,
  rememberPendingMercadoPago,
  rememberReceipt,
  useCart,
} from "../lib/store";
import { resolveTaxId } from "../lib/tax-id";
import type { CheckoutInput, Order } from "../lib/types";

const IZIPAY_LOGO = require("../../assets/payments/izipay.png");
const MERCADO_PAGO_LOGO = require("../../assets/payments/mercadopago.png");

function oneParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw || "").trim();
}

export default function Checkout() {
  const now = useNow();
  const params = useLocalSearchParams<{ pago?: string; pedido?: string }>();
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
    donation: false,
  });
  const explicitCard = params.pago === "card";
  const [method, setMethod] = useState<CheckoutPayMethod | null>(explicitCard ? "card" : null);
  const [payReady, setPayReady] = useState(explicitCard);
  const [mercadoPago, setMercadoPago] = useState(false);
  const [quote, setQuote] = useState<Awaited<ReturnType<ReturnType<typeof getRepo>["quoteCheckout"]>> | null>(null);
  const [credit, setCredit] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [taxTouched, setTaxTouched] = useState(false);
  const [pending, setPending] = useState<Order | null>(null);
  const [reuse, setReuse] = useState<SessionPendingOrder | null>(null);
  const [busy, setBusy] = useState(false);
  const draftRestored = useRef(false);
  const itemsRef = useRef(items);
  const pedidoRef = useRef("");
  itemsRef.current = items;
  pedidoRef.current = oneParam(params.pedido);
  const [picker, setPicker] = useState<"department" | "province" | "district" | null>(null);
  const [query, setQuery] = useState("");
  const reduced = useReducedMotion();
  const [open, setOpen] = useState<CheckoutSection | null>("personal");
  const [done, setDone] = useState<CheckoutSection[]>([]);
  const [accountReady, setAccountReady] = useState(false);
  const [focusNonce, setFocusNonce] = useState(0);
  const booted = useRef(false);
  const userEdited = useRef(false);
  const pendingReveal = useRef<CheckoutSection | null>(null);
  const pendingFocus = useRef<CheckoutField | null>(null);

  useEffect(() => {
    let stopped = false;
    void fetch("/api/payments/methods")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { mercadopago?: boolean } | null) => {
        if (stopped) return;
        const offered = Boolean(data?.mercadopago);
        setMercadoPago(offered);
        setMethod(resolveCheckoutPayMethod(reuse ? "mercadopago" : params.pago, offered));
        setPayReady(true);
      })
      .catch(() => {
        if (stopped) return;
        setMercadoPago(false);
        setMethod(resolveCheckoutPayMethod(params.pago, false));
        setPayReady(true);
      });
    return () => {
      stopped = true;
    };
  }, [params.pago, reuse]);

  const attachGen = useRef(0);
  const attachPendingOrder = useCallback((cartItems: typeof items, pedido: string) => {
    const generation = attachGen.current + 1;
    attachGen.current = generation;
    const candidate = findSessionPendingMercadoPago({
      pedidoToken: pedido,
      cartItems,
      readReceipt: (token) => readReceipt<{ id?: string; publicToken?: string }>(token),
      readPending: readPendingMercadoPago,
    });
    if (!candidate) {
      setReuse(null);
      return;
    }
    const draft = readCheckoutDraft<{ form?: Partial<typeof form> }>();
    if (draft?.form && !draftRestored.current) {
      draftRestored.current = true;
      // Re-run the accordion boot so the restored sections collapse with summaries.
      booted.current = false;
      userEdited.current = false;
      setForm((current) => ({ ...current, ...draft.form }));
      const gift = draft.form;
      if (typeof gift.giftPrinted === "boolean") {
        setGift({
          isGift: gift.giftPrinted,
          to: gift.giftNoteTo || "",
          message: gift.giftNoteMessage || "",
          from: gift.giftNoteFrom || "",
          hidePrices: Boolean(gift.hidePrices),
        });
      }
    }
    void readOrderPaymentStatus(candidate.publicToken).then((status) => {
      if (generation !== attachGen.current) return;
      if (status !== "pending") {
        if (status === "approved" || status === "rejected") {
          clearPendingMercadoPago(cartPendingKey(cartItems));
          clearCheckoutDraft();
        }
        setReuse(null);
        return;
      }
      setReuse(candidate);
    });
  }, [setGift]);

  useEffect(() => {
    attachPendingOrder(items, oneParam(params.pedido));
  }, [attachPendingOrder, items, params.pedido]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return;
    const onPageShow = (event: Event) => {
      if (!checkoutPageShowReset(event as { persisted?: boolean })) return;
      setBusy(false);
      setError(null);
      attachPendingOrder(itemsRef.current, pedidoRef.current);
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [attachPendingOrder]);

  useEffect(() => {
    void getRepo().getCampaign().then(setCampaign);
  }, []);

  useEffect(() => {
    let stopped = false;
    void (async () => {
      const session = await currentCustomer().catch(() => null);
      if (stopped) return;
      let profile: Awaited<ReturnType<ReturnType<typeof getRepo>["getProfile"]>> = null;
      if (session) {
        try {
          profile = await getRepo().getProfile();
        } catch {
          profile = null;
        }
      }
      if (stopped) return;
      setAccount(session);
      setForm((current) => mergeCheckoutProfile(current, session, profile));
      setAccountReady(true);
    })();
    return () => {
      stopped = true;
    };
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
        testProduct: Boolean(item.testProduct),
      })),
      ...form,
      isGift: form.giftPrinted,
      giftNote: form.giftNoteMessage,
      hidePrices: form.hidePrices || form.giftWrap,
      city: form.district,
      province: form.province,
      donationCents: items.length && form.donation ? DONATION_CENTS : 0,
      paymentMethod: checkoutPayMethodForSubmit(method, mercadoPago),
      channel: readWaOrder() ? "whatsapp" : "web",
    }),
    [form, items, method, mercadoPago],
  );

  useEffect(() => {
    const phone = form.phone;
    const handle = setTimeout(() => {
      void getRepo().quoteCheckout(input).then(setQuote);
      void getRepo().creditBalance(phone).then(setCredit);
    }, 200);
    return () => clearTimeout(handle);
  }, [input, form.phone]);

  const testOnly = isTestOnlyCart(items);
  const draft = useMemo(
    () => ({
      customerName: form.customerName,
      phone: form.phone,
      email: form.email,
      clave: password,
      hasAccount: Boolean(account),
      taxId: form.taxId,
      taxIdSkipped: form.taxIdSkipped,
      department: form.department,
      province: form.province,
      district: form.district,
      addressLine: form.addressLine,
      reference: form.reference,
      giftPrinted: form.giftPrinted,
      giftNoteTo: form.giftNoteTo,
      giftNoteMessage: form.giftNoteMessage,
      giftNoteFrom: form.giftNoteFrom,
      hidePrices: form.hidePrices,
      giftWrap: form.giftWrap,
      promoCode: form.promoCode,
      referralCode: form.referralCode,
      giftCardCode: form.giftCardCode,
      promoError: quote?.promoError,
      referralError: quote?.referralError,
      giftCardError: quote?.giftCardError,
    }),
    [account, form, password, quote],
  );

  useEffect(() => {
    if (!accountReady || booted.current) return;
    booted.current = true;
    if (userEdited.current) return;
    setDone(initialAcknowledged(draft));
    const first = initialOpenSection(draft);
    pendingReveal.current = first;
    setOpen(first);
    setFocusNonce((value) => value + 1);
  }, [accountReady, draft]);

  useEffect(() => {
    const header = pendingReveal.current;
    const field = pendingFocus.current;
    if (!header && !field) return;
    const delay = reduced ? 32 : 280;
    const handle = setTimeout(() => {
      if (header && pendingReveal.current === header) {
        pendingReveal.current = null;
        revealHeader(checkoutHeaderId(header), reduced);
      }
      if (field && pendingFocus.current === field) {
        pendingFocus.current = null;
        focusCheckoutField(field);
      }
    }, delay);
    return () => clearTimeout(handle);
  }, [open, focusNonce, reduced]);

  const instant = priceQuote({
    items: items.map((item) => ({
      unitPriceCents: isTestProductItem(item) ? TEST_PRODUCT_CENTS : item.collage ? framedPriceCents(frameById(item.frameId).priceCents, true) : frameById(item.frameId).priceCents,
      kind: isTestProductItem(item) ? "plain" as const : "frame" as const,
    })),
    giftWrap: testOnly ? false : form.giftWrap,
    giftNote: testOnly ? false : form.giftPrinted && form.giftNoteMessage.trim().length > 0 && form.giftNoteMessage.trim().length <= GIFT_NOTE_MESSAGE_MAX,
    donationCents: items.length && form.donation ? DONATION_CENTS : 0,
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
    clearPendingMercadoPago(cartPendingKey(items));
    clearCheckoutDraft();
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
      const payable = checkoutPayMethodForSubmit(method, mercadoPago);
      const paid = await getRepo().markPaid(order.id, {
        method: order.totalCents === 0 ? "gift_card" : payable,
        provider: providerFor(payable, paymentsMode()),
        ref: `${providerFor(payable, paymentsMode())}_${order.id.slice(0, 8)}`,
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

  function focusSection(section: CheckoutSection, field: CheckoutField) {
    userEdited.current = true;
    pendingReveal.current = section;
    pendingFocus.current = field;
    setFocusNonce((value) => value + 1);
    setOpen(section);
  }

  function report(message: string) {
    setError(message);
    const target = focusForCheckoutError(message, draft);
    if (!target) return;
    if (target.field === "taxId") setTaxTouched(true);
    focusSection(target.section, target.field);
  }

  function continuar(section: CheckoutSection) {
    userEdited.current = true;
    const step = afterContinue(section, done, draft);
    if (!step.ok) {
      if (step.field === "taxId") setTaxTouched(true);
      setError(step.error);
      focusSection(section, step.field);
      return;
    }
    setDone(step.done);
    setError(null);
    pendingFocus.current = null;
    pendingReveal.current = step.open;
    setOpen(step.open);
  }

  function omitir(section: CheckoutSection) {
    userEdited.current = true;
    const step = afterSkip(section, done, draft);
    if (!step.ok) {
      if (step.field === "taxId") setTaxTouched(true);
      setError(step.error);
      focusSection(section, step.field);
      return;
    }
    setDone(step.done);
    setError(null);
    pendingFocus.current = null;
    pendingReveal.current = step.open;
    setOpen(step.open);
  }

  function toggleSection(target: CheckoutSection) {
    userEdited.current = true;
    setOpen((current) => {
      const next = toggleCheckoutSection(current, target);
      pendingReveal.current = next;
      pendingFocus.current = null;
      return next;
    });
  }

  async function start() {
    if (items.some((item) => usesExamplePhoto(item))) {
      setError(EXAMPLE_PHOTO_PROMPT);
      return;
    }
    const tax = resolveTaxId({ taxId: form.taxId, skipped: form.taxIdSkipped });
    if (!tax.ok) {
      report(tax.error);
      return;
    }
    if (!account) {
      const problem = passwordError(password);
      if (problem) {
        report(problem);
        return;
      }
    }
    const block = payBlockAfterAccount(draft, {
      cardError: cardMessageError(items),
      lowResBlocked: items.some((item) => item.resolutionStatus === "low") && !form.ackLowRes,
    });
    if (block) {
      if (block.kind === "banner") {
        setError(block.error);
        return;
      }
      report(block.error);
      return;
    }
    if (!payReady || method !== "card" && method !== "mercadopago") {
      setError("Elige cómo quieres pagar.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const wa = readWaOrder();
      const orderInput = { ...input, password: account ? undefined : password };
      const order = await placeCheckoutOrder({
        waOrderId: wa,
        method: checkoutPayMethodForSubmit(method, mercadoPago),
        pedidoToken: oneParam(params.pedido),
        cartItems: items,
        orderInput,
        readReceipt: (token) => readReceipt<{ id?: string; publicToken?: string }>(token),
        readPending: readPendingMercadoPago,
        paymentStatus: readOrderPaymentStatus,
        placeOrder: (value) => getRepo().placeOrder(value),
        updatePendingOrder: (orderId, value) => getRepo().updatePendingOrder(orderId, value),
        revisePendingOrder: (orderId, value) => getRepo().revisePendingOrder(orderId, value),
      });
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
          rememberPendingMercadoPago(cartPendingKey(items), { orderId: order.id, publicToken: order.publicToken });
          rememberCheckoutDraft({ form });
          window.location.href = payload.checkoutUrl;
          return;
        }
        setError(payload.error || "No pudimos abrir Mercado Pago.");
        return;
      }
      if (dataMode() === "supabase" && method === "card") {
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
      setPending(order);
    } catch (err) {
      report(err instanceof Error ? err.message : "Revisa los datos.");
    } finally {
      setBusy(false);
    }
  }

  const focus = error ? focusForCheckoutError(error, draft) : null;
  const pointed = focus && error ? { ...focus, error } : null;

  return (
    <Screen
      seasonal={null}
      footer={
        <View style={{ padding: 16, gap: 8, backgroundColor: colors.bg }}>
          <Text style={{ fontFamily: font.body, color: colors.muted, textAlign: "center", lineHeight: 20 }}>
            Al pagar aceptas los <InlineLink href="/terminos">Términos y condiciones</InlineLink> y la <InlineLink href="/privacidad">Política de privacidad</InlineLink>.
          </Text>
          <Text style={{ fontFamily: font.display, fontSize: 28, color: colors.ink }}>{formatSoles(shownTotal)}</Text>
          <Button label={busy ? "Procesando…" : "Pagar"} disabled={busy || !items.length || !payReady || !method} onPress={() => void start()} />
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
        <Collapsible title="Datos personales" headerId={checkoutHeaderId("personal")} open={open === "personal"} onToggle={() => toggleSection("personal")} badge={sectionBadge("personal", open, done, draft)}>
          <View style={{ gap: 12 }}>
            <Field label="Nombre" nativeID={checkoutFieldId("customerName")} error={pointed?.field === "customerName" ? pointed.error : undefined} value={form.customerName} onChangeText={(customerName) => setForm({ ...form, customerName })} />
            <Field label="Celular" nativeID={checkoutFieldId("phone")} error={pointed?.field === "phone" ? pointed.error : undefined} keyboardType="phone-pad" placeholder="987 654 321" value={form.phone} onChangeText={(phone) => setForm({ ...form, phone })} />
            <Field label="Correo" nativeID={checkoutFieldId("email")} error={pointed?.field === "email" ? pointed.error : undefined} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="lucia@correo.com" value={form.email} onChangeText={(email) => setForm({ ...form, email })} />
            {account ? null : (
              <>
                <Field
                  label="Contraseña"
                  nativeID={checkoutFieldId("clave")}
                  error={pointed?.field === "clave" ? pointed.error : undefined}
                  hint="Crea una contraseña para seguir tu pedido. Si ya tienes cuenta, usa la misma."
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable accessibilityRole="button" onPress={() => setShowPassword((value) => !value)} style={{ minHeight: 44, justifyContent: "center" }}>
                  <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}</Text>
                </Pressable>
              </>
            )}
            <View style={{ opacity: form.taxIdSkipped ? 0.45 : 1 }} pointerEvents={form.taxIdSkipped ? "none" : "auto"}>
              <Field
                label="DNI o RUC (para fines tributarios)"
                nativeID={checkoutFieldId("taxId")}
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
              accessibilityRole="checkbox"
              accessibilityState={{ checked: form.taxIdSkipped }}
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
            <Button label="Continuar" onPress={() => continuar("personal")} />
          </View>
        </Collapsible>
        <Collapsible title="Dirección" headerId={checkoutHeaderId("address")} open={open === "address"} onToggle={() => toggleSection("address")} badge={sectionBadge("address", open, done, draft)}>
          <View style={{ gap: 12 }}>
            {pointed?.section === "address" && pointed.field !== "addressLine" ? <Banner tone="bad" text={pointed.error} /> : null}
            <Pressable accessibilityRole="button" accessibilityLabel={form.department ? `Departamento, ${form.department}` : "Departamento"} nativeID={checkoutFieldId("department")} onPress={() => openPicker("department")} style={choice}>
              <Text style={choiceLabel}>Departamento</Text>
              <Text style={choiceValue}>{form.department || "Elegir"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={form.province ? `Provincia, ${form.province}` : "Provincia"} nativeID={checkoutFieldId("province")} onPress={() => form.department && openPicker("province")} style={[choice, !form.department && { opacity: 0.45 }]}>
              <Text style={choiceLabel}>Provincia</Text>
              <Text style={choiceValue}>{form.province || "Elegir"}</Text>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel={form.district ? `Distrito, ${form.district}` : "Distrito"} nativeID={checkoutFieldId("district")} onPress={() => form.province && openPicker("district")} style={[choice, !form.province && { opacity: 0.45 }]}>
              <Text style={choiceLabel}>Distrito</Text>
              <Text style={choiceValue}>{form.district || "Elegir"}</Text>
            </Pressable>
            <Field label="Dirección" nativeID={checkoutFieldId("addressLine")} error={pointed?.field === "addressLine" ? pointed.error : undefined} value={form.addressLine} onChangeText={(addressLine) => setForm({ ...form, addressLine })} />
            <Field label="Referencia" value={form.reference} onChangeText={(reference) => setForm({ ...form, reference })} />
            <Text style={{ fontFamily: font.semibold, color: zone === "provinces" ? colors.warn : colors.pine }}>
              {testOnly ? "Producto de prueba. El envío es S/ 0 y no entra a producción." : zone === "lima" ? "Lima y Callao · 2 a 3 días hábiles" : zone === "provinces" ? "Provincias · 3 a 5 días hábiles" : "Elige departamento, provincia y distrito para ver el plazo."}
            </Text>
            {form.giftPrinted ? <Text style={{ fontFamily: font.body, color: colors.muted }}>Si el regalo va a otra dirección, márcalo aquí.</Text> : null}
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.otherRecipient }} onPress={() => setForm({ ...form, otherRecipient: !form.otherRecipient })} style={{ minHeight: 44, justifyContent: "center" }}>
              <Text style={{ fontFamily: font.medium, color: colors.ink }}>{form.otherRecipient ? "☑" : "☐"} Se lo envío a otra persona</Text>
            </Pressable>
            {form.otherRecipient ? (
              <>
                <Field label="Nombre de quien lo recibe" value={form.recipientName} onChangeText={(recipientName) => setForm({ ...form, recipientName })} />
                <Field label="Celular de quien lo recibe" value={form.recipientPhone} onChangeText={(recipientPhone) => setForm({ ...form, recipientPhone })} />
              </>
            ) : null}
            <Button label="Continuar" onPress={() => continuar("address")} />
          </View>
        </Collapsible>
        <Collapsible title="Nota (opcional)" headerId={checkoutHeaderId("note")} open={open === "note"} onToggle={() => toggleSection("note")} badge={sectionBadge("note", open, done, draft)}>
          <View style={{ gap: 12 }}>
            {pointed?.section === "note" ? <Banner tone="bad" text={pointed.error} /> : null}
            {testOnly ? <Text style={{ fontFamily: font.body, color: colors.muted, lineHeight: 20 }}>El producto de prueba no lleva nota ni envoltorio.</Text> : (<>
            <GiftNoteEditor
              printed={form.giftPrinted}
              to={form.giftNoteTo}
              message={form.giftNoteMessage}
              fromName={form.giftNoteFrom}
              buyerName={form.customerName}
              hidePrices={form.hidePrices || form.giftWrap}
              toId={checkoutFieldId("giftNoteTo")}
              messageId={checkoutFieldId("giftNoteMessage")}
              fromId={checkoutFieldId("giftNoteFrom")}
              onChange={(next) => {
                setGift({ isGift: next.printed, to: next.to, message: next.message, from: next.fromName, hidePrices: next.hidePrices });
                setForm({ ...form, giftPrinted: next.printed, giftNoteTo: next.to, giftNoteMessage: next.message, giftNoteFrom: next.fromName, hidePrices: next.hidePrices });
              }}
            />
            {form.giftPrinted && !form.giftWrap ? <Text style={{ fontFamily: font.body, color: colors.muted }}>Si quieres, suma el envoltorio. Va aparte de la nota.</Text> : null}
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: form.giftWrap }} onPress={() => setForm({ ...form, giftWrap: !form.giftWrap })} style={{ minHeight: 52, justifyContent: "center", backgroundColor: form.giftWrap ? "#E7F6EE" : colors.white, borderRadius: 16, padding: 12, gap: 4 }}>
              <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{form.giftWrap ? "☑" : "☐"} {campaign?.giftWrapTitle ?? "Envoltorio de regalo"} · S/ 10</Text>
              <Text style={{ fontFamily: font.body, color: colors.muted }}>{campaign?.giftWrapBody ?? "La caja va sin precios."}</Text>
              {form.giftWrap ? <Text style={{ fontFamily: font.medium, color: colors.ink }}>☑ No incluir precios en la caja</Text> : null}
            </Pressable>
            </>)}
            <Button label="Continuar" onPress={() => continuar("note")} />
            <Button label="Omitir nota" tone="ghost" onPress={() => omitir("note")} />
          </View>
        </Collapsible>
        <Collapsible title="Código (opcional)" headerId={checkoutHeaderId("code")} open={open === "code"} onToggle={() => toggleSection("code")} badge={sectionBadge("code", open, done, draft)}>
          <View style={{ gap: 12 }}>
            {pointed?.section === "code" ? <Banner tone="bad" text={pointed.error} /> : null}
            {testOnly ? <Text style={{ fontFamily: font.body, color: colors.muted, lineHeight: 20 }}>Los códigos y el saldo no aplican al producto de prueba.</Text> : <DiscountCodeField
              promoCode={form.promoCode}
              referralCode={form.referralCode}
              giftCardCode={form.giftCardCode}
              phone={form.phone}
              giftAppliedCents={quote?.giftCardAppliedCents}
              inputId={checkoutFieldId("code")}
              onChange={(codes) => setForm((current) => ({ ...current, ...codes }))}
            />}
            <Button label="Continuar" onPress={() => continuar("code")} />
            <Button label="Omitir código" tone="ghost" onPress={() => omitir("code")} />
          </View>
        </Collapsible>
        {credit > 0 && !testOnly ? (
          <Pressable onPress={() => setForm({ ...form, useCredit: !form.useCredit })} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ fontFamily: font.medium, color: colors.ink }}>{form.useCredit ? "☑" : "☐"} Usar mi saldo {formatSoles(credit)}</Text>
          </Pressable>
        ) : null}
        {items.some((item) => item.resolutionStatus === "low") ? (
          <Pressable onPress={() => setForm({ ...form, ackLowRes: !form.ackLowRes })} style={{ minHeight: 44, justifyContent: "center" }}>
            <Text style={{ fontFamily: font.medium, color: colors.ink }}>{form.ackLowRes ? "☑" : "☐"} Acepto imprimir una foto de resolución baja</Text>
          </Pressable>
        ) : null}
        {items.length ? (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: form.donation }}
            onPress={() => setForm({ ...form, donation: !form.donation })}
            style={{ minHeight: 64, justifyContent: "center", gap: 4 }}
          >
            <Text style={{ fontFamily: font.semibold, color: colors.ink, fontSize: 16, lineHeight: 22 }}>{form.donation ? "☑" : "☐"} {donationCheckboxLabel()}</Text>
            <Text style={{ fontFamily: font.body, color: colors.muted, lineHeight: 20 }}>Es opcional y se suma al total.</Text>
          </Pressable>
        ) : null}
        {items.length && form.donation ? <Text style={{ fontFamily: font.medium, color: colors.ink }}>{donationSummaryText()}</Text> : null}
        {reuse ? <Text style={{ fontFamily: font.semibold, color: colors.ink, lineHeight: 22 }}>{PENDING_MP_NOTE}</Text> : null}
        <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Pago</Text>
        <View style={{ gap: 8 }}>
          {checkoutPayOptions(mercadoPago).map((item) => {
            const selected = method === item.id;
            const logo = item.id === "card" ? IZIPAY_LOGO : MERCADO_PAGO_LOGO;
            const logoWidth = item.id === "card" ? 72 : 95;
            return (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                accessibilityLabel={`${item.label} (${item.hint})`}
                accessibilityState={{ selected }}
                onPress={() => setMethod(item.id)}
                style={{ minHeight: 64, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: selected ? colors.ink : colors.white }}
              >
                <View style={{ width: logoWidth + 8, height: 32, borderRadius: 8, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" }}>
                  <Image source={logo} alt={item.label} accessibilityLabel={item.label} style={{ height: 24, width: logoWidth }} contentFit="contain" />
                </View>
                <Text style={{ flex: 1, fontFamily: font.semibold, color: selected ? "white" : colors.ink, fontSize: 15, lineHeight: 20 }}>{item.label} ({item.hint})</Text>
              </Pressable>
            );
          })}
        </View>
        {method === "mercadopago" ? (
          <Text style={{ fontFamily: font.body, color: colors.muted, lineHeight: 20 }}>
            Te llevamos a Mercado Pago. Ahí puedes pagar con Yape, con tarjeta en cuotas, con tu saldo o con PagoEfectivo. El pedido sigue pendiente hasta que Mercado Pago confirme el pago.
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
        {pending && pending.totalCents > 0 && method === "card" ? <PaySheet method="card" total={formatSoles(pending.totalCents)} onApprove={() => void pay(true)} onReject={() => void pay(false)} /> : null}
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
