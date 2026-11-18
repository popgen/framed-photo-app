import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { PaySheet } from "../components/fx";
import { Banner, Button, Field, Screen } from "../components/ui";
import { colors, font } from "../components/theme";
import { formatSoles } from "../lib/money";
import { getRepo } from "../lib/repo";
import type { GiftCard } from "../lib/types";

const PRESETS = [5900, 10900, 12900];

export default function Regalo() {
  const [amount, setAmount] = useState(5900);
  const [custom, setCustom] = useState("");
  const [form, setForm] = useState({ buyerName: "", buyerPhone: "", recipientName: "", recipientPhone: "", recipientEmail: "", message: "" });
  const [pay, setPay] = useState(false);
  const [card, setCard] = useState<GiftCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cents = custom ? Math.round(Number(custom) * 100) : amount;

  return (
    <Screen footer={<View style={{ padding: 16, backgroundColor: colors.bg }}><Button label={`Pagar ${formatSoles(cents || 0)}`} onPress={() => setPay(true)} /></View>}>
      <View style={{ padding: 16, gap: 12 }}>
        <Text style={{ fontFamily: font.display, fontSize: 32, color: colors.ink }}>Gift card</Text>
        <Text style={{ fontFamily: font.body, color: colors.muted }}>Llega por WhatsApp y, si dejas un correo, también por email. Se canjea al pagar un marco.</Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          {PRESETS.map((value) => (
            <Pressable key={value} onPress={() => { setAmount(value); setCustom(""); }} style={{ flex: 1, minHeight: 48, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: !custom && amount === value ? colors.ink : colors.white }}>
              <Text style={{ fontFamily: font.bold, color: !custom && amount === value ? "white" : colors.ink }}>{formatSoles(value)}</Text>
            </Pressable>
          ))}
        </View>
        <Field label="Otro monto en soles" keyboardType="numeric" value={custom} onChangeText={setCustom} />
        <Field label="Tu nombre" value={form.buyerName} onChangeText={(buyerName) => setForm({ ...form, buyerName })} />
        <Field label="Tu celular" value={form.buyerPhone} onChangeText={(buyerPhone) => setForm({ ...form, buyerPhone })} />
        <Field label="Nombre de quien la recibe" value={form.recipientName} onChangeText={(recipientName) => setForm({ ...form, recipientName })} />
        <Field label="Celular de quien la recibe" value={form.recipientPhone} onChangeText={(recipientPhone) => setForm({ ...form, recipientPhone })} />
        <Field label="Correo (opcional)" value={form.recipientEmail} onChangeText={(recipientEmail) => setForm({ ...form, recipientEmail })} />
        <Field label="Mensaje" value={form.message} onChangeText={(message) => setForm({ ...form, message })} />
        {error ? <Banner tone="bad" text={error} /> : null}
        {card ? <Banner tone="good" text={`Lista. El código es ${card.code}. Se lo enviamos por WhatsApp.`} /> : null}
        {pay ? (
          <PaySheet
            method="yape"
            total={formatSoles(cents)}
            onReject={() => setPay(false)}
            onApprove={() => {
              void getRepo()
                .createGiftCard({ amountCents: cents, ...form })
                .then((created) => {
                  setCard(created);
                  setPay(false);
                })
                .catch((err: Error) => {
                  setError(err.message);
                  setPay(false);
                });
            }}
          />
        ) : null}
      </View>
    </Screen>
  );
}
