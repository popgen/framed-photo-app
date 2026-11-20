import { useEffect } from "react";
import { Platform, Pressable, Text, TextInput, View } from "react-native";
import { GIFT_NOTE_CENTS, GIFT_NOTE_MESSAGE_MAX, GIFT_NOTE_NAME_MAX, GIFT_NOTE_SUGGESTIONS } from "../lib/gift-note";
import { formatSoles } from "../lib/money";
import { useReducedMotion } from "./fx";
import { colors, font } from "./theme";

const MOTION = `
@keyframes mifotito-note-in {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@media (prefers-reduced-motion: reduce) {
  .mifotito-note-card { animation: none !important; }
}
`;

export function GiftNoteCard({
  to,
  message,
  from,
  animate = false,
}: {
  to?: string | null;
  message: string;
  from?: string | null;
  animate?: boolean;
}) {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    if (document.getElementById("mifotito-note")) return;
    const sheet = document.createElement("style");
    sheet.id = "mifotito-note";
    sheet.textContent = MOTION;
    document.head.appendChild(sheet);
  }, []);
  const motion = animate && !reduced && Platform.OS === "web" ? { animation: "mifotito-note-in 480ms ease" } : null;
  return (
    <View
      testID="gift-note-preview"
      accessibilityLabel="Vista previa de la nota impresa"
      // @ts-expect-error web class used by the reduced-motion stylesheet
      className="mifotito-note-card"
      style={{
        alignSelf: "center",
        width: "100%",
        maxWidth: 320,
        minHeight: 280,
        backgroundColor: "#FFFDF8",
        borderRadius: 18,
        borderWidth: 1,
        borderStyle: "dashed",
        borderColor: "#C4AD98",
        padding: 20,
        gap: 12,
        ...motion,
      }}
    >
      <Text style={{ fontFamily: font.semibold, letterSpacing: 3, fontSize: 11, color: colors.redDark }}>MI FOTITO</Text>
      {to ? <Text style={{ fontFamily: font.displaySoft, fontSize: 18, color: colors.ink }}>Para {to}</Text> : null}
      <Text style={{ fontFamily: font.displaySoft, fontSize: 22, lineHeight: 30, color: colors.ink, flexGrow: 1 }}>{message}</Text>
      {from ? <Text style={{ fontFamily: font.displaySoft, fontSize: 18, color: colors.ink, textAlign: "right" }}>De {from}</Text> : null}
    </View>
  );
}

export function GiftNoteEditor({
  printed,
  to,
  message,
  fromName,
  buyerName,
  hidePrices,
  onChange,
  toId,
  messageId,
  fromId,
}: {
  printed: boolean;
  to: string;
  message: string;
  fromName: string;
  buyerName: string;
  hidePrices: boolean;
  onChange: (next: { printed: boolean; to: string; message: string; fromName: string; hidePrices: boolean }) => void;
  toId?: string;
  messageId?: string;
  fromId?: string;
}) {
  const price = GIFT_NOTE_CENTS === 0 ? "Gratis" : formatSoles(GIFT_NOTE_CENTS);
  const previewFrom = fromName.trim() || buyerName.trim();
  return (
    <View style={{ gap: 12 }}>
      <Pressable
        testID="gift-note-toggle"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: printed }}
        onPress={() =>
          onChange({
            printed: !printed,
            to,
            message,
            fromName: !printed && !fromName.trim() ? buyerName : fromName,
            hidePrices: printed ? false : hidePrices,
          })
        }
        style={{ minHeight: 52, justifyContent: "center", backgroundColor: printed ? "#E7F6EE" : colors.white, borderRadius: 16, padding: 12, gap: 4 }}
      >
        <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{printed ? "☑" : "☐"} Es un regalo 🎁</Text>
        <Text style={{ fontFamily: font.body, color: colors.muted }}>{price}. Si lo enciendes, puedes agregar una nota impresa para la caja.</Text>
      </Pressable>
      {printed ? (
        <View style={{ gap: 12 }}>
          <Text style={{ fontFamily: font.semibold, color: colors.ink }}>Nota de regalo impresa</Text>
          <Labeled label="Para (opcional)" value={to} maxLength={GIFT_NOTE_NAME_MAX} testID="gift-note-to" nativeID={toId} onChangeText={(value) => onChange({ printed, to: value, message, fromName, hidePrices })} />
          <View style={{ gap: 6 }}>
            <Text style={{ fontFamily: font.medium, color: colors.muted, fontSize: 13 }}>Mensaje</Text>
            <TextInput
              testID="gift-note-message"
              nativeID={messageId}
              multiline
              maxLength={GIFT_NOTE_MESSAGE_MAX}
              placeholder="Unas líneas para quien abre la caja"
              placeholderTextColor="#A89488"
              value={message}
              onChangeText={(value) => onChange({ printed, to, message: value, fromName, hidePrices })}
              style={{ minHeight: 96, borderRadius: 16, backgroundColor: colors.white, padding: 12, fontFamily: font.body, fontSize: 16, color: colors.ink, textAlignVertical: "top" }}
            />
            <Text style={{ fontFamily: font.medium, color: colors.muted, textAlign: "right" }}>{message.length}/{GIFT_NOTE_MESSAGE_MAX}</Text>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {GIFT_NOTE_SUGGESTIONS.map((suggestion) => (
              <Pressable
                key={suggestion}
                accessibilityRole="button"
                onPress={() => onChange({ printed, to, message: suggestion, fromName, hidePrices })}
                style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: message === suggestion ? colors.ink : colors.white }}
              >
                <Text style={{ fontFamily: font.semibold, color: message === suggestion ? "white" : colors.ink }}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
          <Labeled
            label="De (opcional)"
            value={fromName}
            placeholder={buyerName || "Tu nombre"}
            maxLength={GIFT_NOTE_NAME_MAX}
            testID="gift-note-from"
            nativeID={fromId}
            onChangeText={(value) => onChange({ printed, to, message, fromName: value, hidePrices })}
          />
          <Pressable
            testID="hide-prices"
            accessibilityRole="checkbox"
            accessibilityState={{ checked: hidePrices }}
            onPress={() => onChange({ printed, to, message, fromName, hidePrices: !hidePrices })}
            style={{ minHeight: 44, justifyContent: "center" }}
          >
            <Text style={{ fontFamily: font.medium, color: colors.ink }}>{hidePrices ? "☑" : "☐"} No incluir precios en la caja</Text>
          </Pressable>
          {message.trim() ? <GiftNoteCard to={to.trim()} message={message.trim()} from={previewFrom} animate /> : null}
        </View>
      ) : null}
    </View>
  );
}

function Labeled({
  label,
  value,
  onChangeText,
  placeholder,
  maxLength,
  testID,
  nativeID,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  testID?: string;
  nativeID?: string;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontFamily: font.medium, color: colors.muted, fontSize: 13 }}>{label}</Text>
      <TextInput
        testID={testID}
        nativeID={nativeID}
        maxLength={maxLength}
        placeholder={placeholder}
        placeholderTextColor="#A89488"
        value={value}
        onChangeText={onChangeText}
        style={{ minHeight: 48, borderRadius: 16, backgroundColor: colors.white, paddingHorizontal: 12, fontFamily: font.body, fontSize: 16, color: colors.ink }}
      />
    </View>
  );
}
