import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Banner, Button, Field } from "./ui";
import { colors, font } from "./theme";
import { checkOtp, otpFailureMessage, prepareSend, publicSendResult, SESSION_TTL_MS, signSession, type OtpRecord, type SendStamp } from "../lib/otp";
import { savePhoneSession } from "../lib/phone-session";
import { normalizePhone } from "../lib/phone";
import { getSupabase } from "../lib/supabase";
import { dataMode } from "../lib/env";

const localSends: SendStamp[] = [];
let localRecord: OtpRecord | null = null;

export function PhoneVerify({ onVerified, title }: { onVerified: (phone: string) => void; title: string }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wait, setWait] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!wait) return;
    const timer = setInterval(() => setWait((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [wait]);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/shop?op=otp-send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!response.ok && response.status !== 200) throw new Error("network");
      const json = await response.json();
      if (json.ok === false && json.error && !json.demoCode) {
        setError(json.error);
        if (json.retryAt) setWait(Math.max(1, Math.ceil((json.retryAt - Date.now()) / 1000)));
        return;
      }
      if (response.status >= 500) throw new Error("network");
      setSent(true);
      setDemoCode(json.demoCode ?? null);
      setWait(60);
    } catch {
      const now = Date.now();
      const normalized = normalizePhone(phone);
      const prepared = await prepareSend({
        phone,
        now,
        phoneSends: localSends.filter((item) => item.at > now - 3_600_000),
        ipSends: localSends.filter((item) => item.at > now - 3_600_000),
      });
      const shown = publicSendResult(prepared, true);
      if (!shown.ok) {
        setError(shown.error);
        if (shown.retryAt) setWait(Math.max(1, Math.ceil((shown.retryAt - now) / 1000)));
        return;
      }
      if (prepared.ok) {
        localRecord = prepared.record;
        localSends.push({ at: now });
      }
      setSent(true);
      setDemoCode(shown.demoCode ?? null);
      setWait(60);
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      let json: { ok?: boolean; error?: string; token?: string; phone?: string; exp?: number; tokenHash?: string | null } | null = null;
      try {
        const response = await fetch("/api/shop?op=otp-verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone, code }),
        });
        json = await response.json();
      } catch {
        json = null;
      }
      if (!json) {
        const result = await checkOtp(localRecord, code, Date.now());
        localRecord = result.record;
        if (!result.ok || !localRecord) {
          setError(otpFailureMessage());
          return;
        }
        const exp = Date.now() + SESSION_TTL_MS;
        const token = await signSession(localRecord.phone, "mifotito-demo-otp", exp);
        savePhoneSession({ token, phone: localRecord.phone, exp });
        onVerified(localRecord.phone);
        return;
      }
      if (!json.ok || !json.token || !json.phone || !json.exp) {
        setError(json.error || otpFailureMessage());
        return;
      }
      savePhoneSession({ token: json.token, phone: json.phone, exp: json.exp });
      if (json.tokenHash && dataMode() === "supabase") {
        await getSupabase().auth.verifyOtp({ token_hash: json.tokenHash, type: "email" }).catch(() => null);
      }
      onVerified(json.phone);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>{title}</Text>
      <Text style={{ fontFamily: font.body, color: colors.muted }}>Te escribimos un código por WhatsApp. No hace falta el número de pedido.</Text>
      <Field label="Celular" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      {sent ? <Field label="Código de 6 dígitos" keyboardType="number-pad" value={code} onChangeText={setCode} maxLength={6} /> : null}
      {demoCode ? <Banner tone="warn" text={`Modo demo. Tu código es ${demoCode}. No se envió por WhatsApp.`} /> : null}
      {error ? <Banner tone="bad" text={error} /> : null}
      {!sent ? <Button label={busy ? "Enviando…" : "Enviar código"} onPress={() => void send()} /> : null}
      {sent ? <Button label={busy ? "Revisando…" : "Ver mis pedidos"} onPress={() => void verify()} /> : null}
      {sent ? (
        <Pressable disabled={wait > 0 || busy} onPress={() => void send()} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ fontFamily: font.semibold, color: wait > 0 ? colors.muted : colors.ink }}>{wait > 0 ? `Reenviar en ${wait}s` : "Reenviar código"}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
