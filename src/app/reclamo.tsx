import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Honeypot } from "../components/Honeypot";
import { Banner, Button, Field, Screen } from "../components/ui";
import { colors, font } from "../components/theme";
import { HONEYPOT_FIELD } from "../lib/contact";
import { isEmail } from "../lib/phone";
import { pickAndSavePhotos } from "../lib/photos";
import { getRepo } from "../lib/repo";
import { useContactSend } from "../lib/use-contact";

export default function Reclamo() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(String(params.token ?? ""));
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [photoId, setPhotoId] = useState<string | undefined>();
  const [honey, setHoney] = useState("");
  const { busy, sent, error, setError, send: sendMail } = useContactSend();

  return (
    <Screen footer={<View style={{ padding: 16, backgroundColor: colors.bg }}><Button label={busy ? "Enviando…" : "Enviar reclamo"} disabled={busy || sent} onPress={() => void send()} /></View>}>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Llegó dañado</Text>
        <Text style={{ fontFamily: font.body, color: colors.muted }}>Cuéntanos qué pasó y sube una foto. Si corresponde, reponemos el marco sin costo.</Text>
        <Field label="Código del enlace" value={token} onChangeText={setToken} />
        <Field label="Celular del pedido" value={phone} onChangeText={setPhone} />
        <Field label="Correo" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Field label="Qué pasó" value={note} onChangeText={setNote} />
        <Button label={photoId ? "Foto lista" : "Subir foto del daño"} tone="ghost" onPress={() => void pickAndSavePhotos(false).then((saved) => setPhotoId(saved[0]?.id))} />
        <Honeypot value={honey} onChangeText={setHoney} />
        {error ? <Banner tone="bad" text={error} /> : null}
        {sent ? <Banner tone="good" text="Recibimos el reclamo. Te escribimos por correo." /> : null}
      </View>
    </Screen>
  );

  async function send() {
    if (busy || sent) return;
    if (!isEmail(email)) {
      setError("Ingresa el correo donde te escribimos.");
      return;
    }
    const cleanNote = note.trim();
    await sendMail(
      {
        type: "reclamo",
        email: email.trim(),
        phone: phone.trim(),
        message: photoId ? `${cleanNote}\n\nAdjuntamos una foto del daño en el reclamo.` : cleanNote,
        token: token.trim(),
        [HONEYPOT_FIELD]: honey,
      },
      {
        before: async () => {
          await getRepo().createClaim({ token: token.trim(), phone, note: `Correo: ${email.trim()}\n${cleanNote}`, photoId });
        },
      },
    );
  }
}
