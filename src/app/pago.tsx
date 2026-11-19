import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Button, Screen } from "../components/ui";
import { colors, font } from "../components/theme";

const SCRIPT = "https://static.micuentaweb.pe/static/js/krypton-client/V4.0/stable/kr-payment-form.min.js";
const STYLE = "https://static.micuentaweb.pe/static/js/krypton-client/V4.0/ext/classic.css";

const ERROR_COPY: Record<string, string> = {
  rechazado: "El pago fue rechazado. Puedes intentar otra vez.",
  cancelado: "Cancelaste el pago. Puedes intentar otra vez.",
  firma: "No pudimos verificar el pago. Si te cobraron, escríbenos a pedidos@mifotito.com.",
  "1": "No pudimos confirmar el pago. Puedes intentar otra vez.",
};

export default function Pago() {
  const params = useLocalSearchParams<{ error?: string; estado?: string; pedido?: string; codigo?: string }>();
  const host = useRef(null);
  const waiting = params.estado === "esperando";
  const [message, setMessage] = useState<string | null>(params.error ? ERROR_COPY[params.error] || ERROR_COPY["1"] : waiting ? "Recibimos la respuesta del pago. Lo estamos confirmando." : null);

  useEffect(() => {
    if (!waiting) return;
    let stopped = false;
    const tick = async () => {
      const query = params.codigo ? `codigo=${encodeURIComponent(String(params.codigo))}` : `pedido=${encodeURIComponent(String(params.pedido || ""))}`;
      const response = await fetch(`/api/payments/status?${query}`);
      const payload = (await response.json().catch(() => ({}))) as { status?: string };
      if (stopped) return;
      if (payload.status === "approved") {
        if (params.codigo) router.replace(`/regalo?listo=1&codigo=${encodeURIComponent(String(params.codigo))}`);
        else if (params.pedido) router.replace(`/confirmacion/${params.pedido}`);
      }
    };
    void tick();
    const timer = setInterval(() => void tick(), 2000);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [params.codigo, params.pedido, waiting]);

  useEffect(() => {
    if (params.error || waiting || typeof document === "undefined") return;
    const raw = window.sessionStorage.getItem("mifotito-izipay");
    if (!raw) {
      setMessage("El pago expiró. Vuelve al pago e inténtalo otra vez.");
      return;
    }
    const saved = JSON.parse(raw) as { formToken?: string; publicKey?: string };
    const node = host.current as unknown as HTMLElement | null;
    if (!saved.formToken || !saved.publicKey || !node) {
      setMessage("El pago expiró. Vuelve al pago e inténtalo otra vez.");
      return;
    }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = STYLE;
    document.head.appendChild(link);
    const slot = document.createElement("div");
    slot.className = "kr-embedded";
    slot.setAttribute("kr-form-token", saved.formToken);
    node.appendChild(slot);
    const script = document.createElement("script");
    script.src = SCRIPT;
    script.setAttribute("kr-public-key", saved.publicKey);
    script.setAttribute("kr-post-url-success", `${window.location.origin}/api/payments/izipay-return`);
    script.setAttribute("kr-language", "es-ES");
    document.head.appendChild(script);
    return () => {
      script.remove();
      slot.remove();
      link.remove();
    };
  }, [params.error, waiting]);

  return (
    <Screen>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Pago seguro</Text>
        <Text style={{ fontFamily: font.body, color: colors.muted, lineHeight: 22 }}>Tarjeta o Yape, en la pasarela de Izipay.</Text>
        {message ? <Text style={{ fontFamily: font.medium, color: params.error ? colors.bad : colors.ink }}>{message}</Text> : null}
        <View ref={host} />
        {params.error ? <Button label="Intentar otra vez" onPress={() => router.replace("/checkout")} /> : null}
      </View>
    </Screen>
  );
}
