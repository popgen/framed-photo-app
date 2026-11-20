import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { GiftNoteCard } from "../../components/GiftNoteCard";
import { GiftSuccess } from "../../components/fx";
import { useApp } from "../../components/provider";
import { Button, Screen } from "../../components/ui";
import { colors, font } from "../../components/theme";
import { rememberWaOrder } from "../../lib/boot";
import { mercadoPagoConfirmationState } from "../../lib/mercadopago";
import { donationSummaryText, DONATION_CENTS } from "../../lib/donation";
import { formatSoles } from "../../lib/money";
import { isTestOnlyCart } from "../../lib/test-product";
import { getRepo } from "../../lib/repo";
import { cartPendingKey, clearCheckoutDraft, clearPendingMercadoPago, readReceipt, rememberReceipt, useCart } from "../../lib/store";
import type { Order } from "../../lib/types";

export default function Confirmacion() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const clear = useCart((state) => state.clear);
  const { refresh } = useApp();
  const [order, setOrder] = useState<Order | null>(readReceipt<Order>(String(token)));
  const [remoteStatus, setRemoteStatus] = useState<string | null>(null);
  const [campaignTitle, setCampaignTitle] = useState("Tu recuerdo ya va en camino");
  const [campaignBody, setCampaignBody] = useState("Te escribimos por correo cuando avance.");
  const sawPending = useRef(false);
  const finished = useRef(false);
  const mpState = mercadoPagoConfirmationState({
    paymentMethod: order?.paymentMethod,
    paymentStatus: order?.paymentStatus,
    remoteStatus,
  });

  useEffect(() => {
    void getRepo().getCampaign().then((campaign) => {
      setCampaignTitle(campaign.successTitle);
      setCampaignBody(campaign.successBody);
    });
    const cached = readReceipt<Order>(String(token));
    if (!cached) return;
    void getRepo().getOrderByToken(String(token), cached.phone).then((live) => {
      if (live) setOrder({ ...live, accountNotice: live.accountNotice || cached.accountNotice });
    });
  }, [token]);

  useEffect(() => {
    if (order?.paymentMethod === "mercadopago" && order.paymentStatus !== "approved") sawPending.current = true;
  }, [order?.paymentMethod, order?.paymentStatus]);

  useEffect(() => {
    if (!sawPending.current || finished.current) return;
    if (mpState !== "approved" || order?.paymentMethod !== "mercadopago") return;
    finished.current = true;
    clearPendingMercadoPago(cartPendingKey(useCart.getState().items));
    clearCheckoutDraft();
    clear();
    rememberWaOrder(null);
    refresh();
  }, [clear, mpState, order?.paymentMethod, refresh]);

  useEffect(() => {
    if (order?.paymentMethod !== "mercadopago" || order.paymentStatus === "approved" || order.paymentStatus === "rejected") return;
    let stopped = false;
    const tick = async () => {
      const response = await fetch(`/api/payments/status?pedido=${encodeURIComponent(String(token || ""))}`);
      const payload = (await response.json().catch(() => ({}))) as { status?: string };
      if (stopped || !payload.status) return;
      setRemoteStatus(payload.status);
      if (payload.status === "approved" || payload.status === "rejected") {
        setOrder((current) => {
          if (!current) return current;
          const next = { ...current, paymentStatus: payload.status as Order["paymentStatus"] };
          rememberReceipt(next);
          return next;
        });
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [order?.paymentMethod, order?.paymentStatus, token]);

  if (!order) {
    return (
      <Screen>
        <View style={{ padding: 20, gap: 12 }}>
          <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Busca tu pedido con el celular</Text>
          <Button label="Ver estado" onPress={() => router.push(`/pedido/${token}`)} />
        </View>
      </Screen>
    );
  }

  if (mpState === "pending" || mpState === "rejected") {
    return (
      <Screen>
        <View style={{ padding: 20, gap: 14 }}>
          <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink, textAlign: "center" }}>
            {mpState === "rejected" ? "Pago no aprobado" : "Pago pendiente"}
          </Text>
          <Text style={{ fontFamily: font.display, fontSize: 28, color: colors.ink, textAlign: "center" }}>{order.number}</Text>
          <Text style={{ fontFamily: font.semibold, color: colors.ink, textAlign: "center" }}>{formatSoles(order.totalCents)}</Text>
          <Text style={{ fontFamily: font.body, color: colors.muted, textAlign: "center", lineHeight: 22 }}>
            {mpState === "rejected"
              ? "Mercado Pago no aprobó el pago. No cobramos el pedido. Puedes intentar otra vez."
              : "Estamos esperando la confirmación de Mercado Pago. Si elegiste PagoEfectivo, paga con el código que te mostraron. El pedido no entra a producción hasta que el pago quede aprobado."}
          </Text>
          {mpState === "rejected" ? <Button label="Volver al pago" onPress={() => router.replace("/checkout")} /> : null}
          <Button label="Seguir el pedido" tone={mpState === "rejected" ? "ghost" : "primary"} onPress={() => router.push(`/pedido/${order.publicToken}`)} />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ padding: 20, gap: 14 }}>
        {isTestOnlyCart(order.items) ? (
          <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink, textAlign: "center" }}>Recibimos el pago de prueba</Text>
        ) : (
          <GiftSuccess title={campaignTitle} body={campaignBody} />
        )}
        <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink, textAlign: "center" }}>{order.number}</Text>
        <Text style={{ fontFamily: font.semibold, color: colors.ink, textAlign: "center" }}>{formatSoles(order.totalCents)}</Text>
        {order.donationCents === DONATION_CENTS ? <Text style={{ fontFamily: font.medium, color: colors.ink, textAlign: "center" }}>{donationSummaryText()}</Text> : null}
        <Text style={{ fontFamily: font.medium, color: colors.muted, textAlign: "center" }}>Guarda este número. Puedes entrar más tarde con tu correo y contraseña para seguir tu pedido.</Text>
        {order.accountNotice ? <Text style={{ fontFamily: font.medium, color: colors.ink, textAlign: "center" }}>{order.accountNotice}</Text> : null}
        {isTestOnlyCart(order.items) ? (
          <Text style={{ fontFamily: font.body, color: colors.muted, textAlign: "center" }}>Este pedido no entra a producción.</Text>
        ) : (
          <Text style={{ fontFamily: font.body, color: colors.muted, textAlign: "center" }}>{order.etaLabel}. {order.christmasNote}</Text>
        )}
        {order.isGift ? <Text style={{ fontFamily: font.semibold, color: colors.ink, textAlign: "center" }}>Regalo</Text> : null}
        {order.giftNoteMessage ? (
          <View style={{ gap: 8 }}>
            <Text style={{ fontFamily: font.semibold, color: colors.ink, textAlign: "center" }}>Nota impresa en la caja</Text>
            <GiftNoteCard to={order.giftNoteTo} message={order.giftNoteMessage} from={order.giftNoteFrom} />
            {order.hidePrices ? <Text style={{ fontFamily: font.body, color: colors.muted, textAlign: "center" }}>La caja va sin precios.</Text> : null}
          </View>
        ) : null}
        {order.referralCodeIssued ? (
          <View style={{ backgroundColor: colors.white, borderRadius: 18, padding: 14 }}>
            <Text style={{ fontFamily: font.medium, color: colors.muted }}>Tu código de amigo</Text>
            <Text style={{ fontFamily: font.display, fontSize: 28, color: colors.ink }}>{order.referralCodeIssued}</Text>
            <Text style={{ fontFamily: font.body, color: colors.muted }}>Quien lo use ahorra S/ 15 y tú recibes S/ 15 de saldo.</Text>
          </View>
        ) : null}
        <Button label="Seguir el pedido" onPress={() => router.push(`/pedido/${order.publicToken}`)} />
        <Button label="Armar otro" tone="ghost" onPress={() => router.push("/crear")} />
      </View>
    </Screen>
  );
}
