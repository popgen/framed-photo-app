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
  const [channel, setChannel] = useState<"whatsapp" | "email" | "support" | "demo" | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [supportUrl, setSupportUrl] = useState<string | null>(null);
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
      const response = await fetch("/api/otp-send", {
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
      setHint(json.message ?? null);
      setSupportUrl(json.supportUrl ?? null);
      setChannel(json.channel || (json.demoCode ? "demo" : "whatsapp"));
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
        const response = await fetch("/api/otp-verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone, code, channel: channel === "email" ? "email" : undefined }),
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
      <Text style={{ fontFamily: font.body, color: colors.muted }}>Escribe el celular del pedido. Si dejaste un correo, te escribimos ahí. El código por WhatsApp queda para cuando activemos WhatsApp Business.</Text>
      <Field label="Celular" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
      {sent && channel !== "support" ? <Field label="Código de 6 dígitos" keyboardType="number-pad" value={code} onChangeText={setCode} maxLength={6} /> : null}
      {demoCode ? <Banner tone="warn" text={`Modo demo. Tu código es ${demoCode}. No se envió por WhatsApp.`} /> : null}
      {hint && !demoCode ? <Banner tone="warn" text={hint} /> : null}
      {error ? <Banner tone="bad" text={error} /> : null}
      {channel === "support" && supportUrl ? <Button label="Escríbenos por WhatsApp" onPress={() => openSupport(supportUrl)} /> : null}
      {channel === "email" ? <Button label={busy ? "Revisando…" : "Ya abrí el enlace del correo"} tone="ghost" onPress={() => void continueWithEmail()} /> : null}
      {!sent ? <Button label={busy ? "Enviando…" : "Continuar"} onPress={() => void send()} /> : null}
      {sent && channel !== "support" ? <Button label={busy ? "Revisando…" : "Ver mis pedidos"} onPress={() => void verify()} /> : null}
      {sent && channel !== "support" ? (
        <Pressable disabled={wait > 0 || busy} onPress={() => void send()} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ fontFamily: font.semibold, color: wait > 0 ? colors.muted : colors.ink }}>{wait > 0 ? `Reenviar en ${wait}s` : "Reenviar código"}</Text>
        </Pressable>
      ) : null}
    </View>
  );

  async function continueWithEmail() {
    setBusy(true);
    setError(null);
    try {
      const session = dataMode() === "supabase" ? (await getSupabase().auth.getSession()).data.session : null;
      if (!session?.access_token) {
        setError("Abre el enlace del correo en este navegador y vuelve a intentar.");
        return;
      }
      const response = await fetch("/api/otp-verify", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ magic: true }),
      });
      const json = await response.json();
      if (!json.ok || !json.token || !json.phone || !json.exp) {
        setError(json.error || json.message || otpFailureMessage());
        if (json.supportUrl) setSupportUrl(json.supportUrl);
        return;
      }
      savePhoneSession({ token: json.token, phone: json.phone, exp: json.exp });
      onVerified(json.phone);
    } finally {
      setBusy(false);
    }
  }
}

function openSupport(url: string) {
  if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
}
