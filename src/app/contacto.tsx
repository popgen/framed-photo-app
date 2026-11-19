import { useState } from "react";
import { Text, View } from "react-native";
import { Honeypot } from "../components/Honeypot";
import { Button, Field, Screen } from "../components/ui";
import { colors, font } from "../components/theme";
import { CONTACT_SUCCESS, HONEYPOT_FIELD } from "../lib/contact";
import { useContactSend } from "../lib/use-contact";

export default function Contacto() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [honey, setHoney] = useState("");
  const { busy, sent, error, send } = useContactSend();

  async function submit() {
    if (busy || sent) return;
    const ok = await send({
      type: "contacto",
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
      [HONEYPOT_FIELD]: honey,
    });
    if (ok) {
      setName("");
      setEmail("");
      setMessage("");
    }
  }

  return (
    <Screen>
      <View style={{ padding: 16, gap: 14 }}>
        <Text accessibilityRole="header" style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Escríbenos</Text>
        <Text style={{ fontFamily: font.body, color: colors.muted, lineHeight: 22 }}>
          Cuéntanos tu consulta. Te respondemos a pedidos@mifotito.com.
        </Text>
        <Field label="Nombre" value={name} onChangeText={setName} autoComplete="name" />
        <Field label="Correo" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} />
        <Field label="Mensaje" value={message} onChangeText={setMessage} multiline style={{ minHeight: 120, textAlignVertical: "top" }} />
        <Honeypot value={honey} onChangeText={setHoney} />
        {error ? <Text style={{ fontFamily: font.body, color: colors.bad }}>{error}</Text> : null}
        {sent ? <Text style={{ fontFamily: font.medium, color: colors.pine }}>{CONTACT_SUCCESS}</Text> : null}
        <Button label={busy ? "Enviando…" : "Enviar"} disabled={busy || sent} onPress={() => void submit()} />
      </View>
    </Screen>
  );
}
