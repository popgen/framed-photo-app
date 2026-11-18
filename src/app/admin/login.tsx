import { router } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { Banner, Button, Field } from "../../components/ui";
import { colors, font } from "../../components/theme";
import { demoAdmin } from "../../lib/env";
import { getRepo } from "../../lib/repo";

export default function AdminLogin() {
  const demo = demoAdmin();
  const [email, setEmail] = useState(demo.email);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Equipo Mi Fotito</Text>
      <Text style={{ fontFamily: font.body, color: colors.muted }}>En la demo local entra con {demo.email}. Con Supabase usa un usuario de admin_users.</Text>
      <Field label="Correo" autoCapitalize="none" value={email} onChangeText={setEmail} />
      <Field label="Contraseña" secureTextEntry value={password} onChangeText={setPassword} />
      {error ? <Banner tone="bad" text={error} /> : null}
      <Button
        label="Entrar"
        onPress={() => {
          void getRepo().adminLogin(email, password).then((result) => {
            if (!result.ok) setError(result.error ?? "No pudimos entrar.");
            else router.replace("/admin");
          });
        }}
      />
    </View>
  );
}
