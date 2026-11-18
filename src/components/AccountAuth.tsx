import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { InlineLink } from "./InlineLink";
import { Button, Field } from "./ui";
import { colors, font } from "./theme";
import {
  recoveryFromLocation,
  sendPasswordReset,
  signInCustomer,
  signUpCustomer,
  updateCustomerPassword,
  type CustomerSession,
} from "../lib/customer-auth";

export function AccountAuth({ title, onReady }: { title: string; onReady: (session: CustomerSession) => void }) {
  const [mode, setMode] = useState<"entrar" | "crear" | "olvide" | "nueva">(recoveryFromLocation() ? "nueva" : "entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      if (mode === "olvide") {
        const result = await sendPasswordReset(email);
        if (!result.ok) setError(result.error);
        else setNote(result.message);
        return;
      }
      if (mode === "nueva") {
        const result = await updateCustomerPassword(password);
        if (!result.ok) setError(result.error);
        else {
          setNote("Listo. Ya puedes entrar con la contraseña nueva.");
          setMode("entrar");
          setPassword("");
        }
        return;
      }
      const result = mode === "crear" ? await signUpCustomer(email, password) : await signInCustomer(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onReady(result.session);
    } finally {
      setBusy(false);
    }
  }

  const label = mode === "crear" ? "Crear cuenta" : mode === "olvide" ? "Enviar enlace" : mode === "nueva" ? "Guardar contraseña" : "Entrar";

  return (
    <View style={{ gap: 12 }}>
      <Text accessibilityRole="header" style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>{title}</Text>
      <Text style={{ fontFamily: font.body, color: colors.muted }}>
        {mode === "nueva" ? "Elige una contraseña nueva, de al menos 8 caracteres." : "Entra con tu correo y contraseña, o crea una cuenta. Mínimo 8 caracteres."}
      </Text>
      {mode === "nueva" ? null : (
        <Field label="Correo" autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="lucia@correo.com" value={email} onChangeText={setEmail} />
      )}
      {mode === "olvide" ? null : (
        <Field label={mode === "nueva" ? "Nueva contraseña" : "Contraseña"} secureTextEntry={!visible} autoCapitalize="none" value={password} onChangeText={setPassword} />
      )}
      {mode === "olvide" ? null : (
        <Pressable onPress={() => setVisible((value) => !value)} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{visible ? "Ocultar contraseña" : "Mostrar contraseña"}</Text>
        </Pressable>
      )}
      {error ? <Text style={{ fontFamily: font.medium, color: colors.bad }}>{error}</Text> : null}
      {note ? <Text style={{ fontFamily: font.medium, color: colors.pine }}>{note}</Text> : null}
      {mode === "crear" ? (
        <Text style={{ fontFamily: font.body, color: colors.muted, lineHeight: 22 }}>
          Al crear tu cuenta aceptas los <InlineLink href="/terminos">Términos y condiciones</InlineLink> y la <InlineLink href="/privacidad">Política de privacidad</InlineLink>.
        </Text>
      ) : null}
      <Button label={busy ? "Un momento…" : label} disabled={busy} onPress={() => void submit()} />
      {mode === "entrar" ? (
        <Pressable onPress={() => { setMode("olvide"); setError(null); setNote(null); }} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Olvidé mi contraseña</Text>
        </Pressable>
      ) : null}
      {mode === "nueva" ? null : (
        <Pressable onPress={() => { setMode(mode === "crear" ? "entrar" : "crear"); setError(null); setNote(null); }} style={{ minHeight: 44, justifyContent: "center" }}>
          <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{mode === "crear" ? "Ya tengo cuenta" : "Crear cuenta"}</Text>
        </Pressable>
      )}
    </View>
  );
}
