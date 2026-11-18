import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { Button, Screen } from "../components/ui";
import { colors, font } from "../components/theme";

const SCRIPT = "https://static.micuentaweb.pe/static/js/krypton-client/V4.0/stable/kr-payment-form.min.js";
const STYLE = "https://static.micuentaweb.pe/static/js/krypton-client/V4.0/ext/classic.css";

export default function Pago() {
  const params = useLocalSearchParams<{ error?: string }>();
  const host = useRef(null);
  const [message, setMessage] = useState<string | null>(params.error ? "No pudimos confirmar el pago. Puedes volver e intentarlo otra vez." : null);

  useEffect(() => {
    if (params.error || typeof document === "undefined") return;
    const raw = window.sessionStorage.getItem("mifotito-izipay");
    if (!raw) {
      setMessage("El pago expiró. Vuelve al checkout e inténtalo otra vez.");
      return;
    }
    const saved = JSON.parse(raw) as { formToken?: string; publicKey?: string };
    const node = host.current as unknown as HTMLElement | null;
    if (!saved.formToken || !saved.publicKey || !node) {
      setMessage("El pago expiró. Vuelve al checkout e inténtalo otra vez.");
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
  }, [params.error]);

  return (
    <Screen>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Pago seguro</Text>
        <Text style={{ fontFamily: font.body, color: colors.muted, lineHeight: 22 }}>Tarjeta o Yape, en la pasarela de Izipay.</Text>
        {message ? <Text style={{ fontFamily: font.medium, color: colors.bad }}>{message}</Text> : null}
        <View ref={host} />
        {message ? <Button label="Volver al checkout" onPress={() => router.replace("/checkout")} /> : null}
      </View>
    </Screen>
  );
}
