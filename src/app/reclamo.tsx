import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Banner, Button, Field, Screen } from "../components/ui";
import { colors, font } from "../components/theme";
import { pickAndSavePhotos } from "../lib/photos";
import { getRepo } from "../lib/repo";

export default function Reclamo() {
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState(String(params.token ?? ""));
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [photoId, setPhotoId] = useState<string | undefined>();
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen footer={<View style={{ padding: 16, backgroundColor: colors.bg }}><Button label="Enviar reclamo" onPress={() => void send()} /></View>}>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Llegó dañado</Text>
        <Text style={{ fontFamily: font.body, color: colors.muted }}>Cuéntanos qué pasó y sube una foto. Si corresponde, reponemos el marco sin costo.</Text>
        <Field label="Código del enlace" value={token} onChangeText={setToken} />
        <Field label="Celular del pedido" value={phone} onChangeText={setPhone} />
        <Field label="Qué pasó" value={note} onChangeText={setNote} />
        <Button label={photoId ? "Foto lista" : "Subir foto del daño"} tone="ghost" onPress={() => void pickAndSavePhotos(false).then((saved) => setPhotoId(saved[0]?.id))} />
        {error ? <Banner tone="bad" text={error} /> : null}
        {done ? <Banner tone="good" text="Recibimos el reclamo. Te escribimos por WhatsApp." /> : null}
      </View>
    </Screen>
  );

  async function send() {
    try {
      await getRepo().createClaim({ token: token.trim(), phone, note, photoId });
      setDone(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar el reclamo.");
    }
  }
}
