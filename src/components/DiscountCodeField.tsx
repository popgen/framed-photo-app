import { useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import {
  appliedDiscountChips,
  applyClassifiedCode,
  classifyDiscountCode,
  clearDiscountKind,
  giftAppliedLabel,
  type AppliedDiscountFields,
  type DiscountKind,
  type DiscountSources,
} from "../lib/discount-code";
import { getRepo } from "../lib/repo";
import { colors, font } from "./theme";
import { Banner } from "./ui";

export function DiscountCodeField({
  promoCode,
  referralCode,
  giftCardCode,
  phone,
  giftAppliedCents,
  onChange,
  inputId,
}: AppliedDiscountFields & { phone: string; giftAppliedCents?: number; onChange: (next: AppliedDiscountFields) => void; inputId?: string }) {
  const [draft, setDraft] = useState("");
  const [notice, setNotice] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [sources, setSources] = useState<DiscountSources | null>(null);
  const fields = { promoCode, referralCode, giftCardCode };
  const chips = appliedDiscountChips(fields);
  const banner =
    notice?.tone === "good" && notice.text.startsWith("Tarjeta de regalo aplicada") && giftAppliedCents
      ? { tone: "good" as const, text: giftAppliedLabel(giftAppliedCents, giftAppliedCents) }
      : notice;

  useEffect(() => {
    let live = true;
    void getRepo()
      .discountCatalog()
      .then((catalog) => {
        if (live) setSources(catalog);
      })
      .catch(() => {
        if (live) setSources(null);
      });
    return () => {
      live = false;
    };
  }, []);

  async function apply() {
    let catalog = sources;
    if (!catalog) {
      try {
        catalog = await getRepo().discountCatalog();
        setSources(catalog);
      } catch {
        setNotice({ tone: "bad", text: "No pudimos revisar el código. Inténtalo otra vez." });
        return;
      }
    }
    const result = classifyDiscountCode(draft, catalog, { phone });
    if (!result.ok) {
      setNotice({ tone: "bad", text: result.error });
      return;
    }
    onChange(applyClassifiedCode(fields, result));
    setDraft("");
    setNotice({ tone: "good", text: result.message });
  }

  function remove(kind: DiscountKind) {
    onChange(clearDiscountKind(fields, kind));
    setNotice(null);
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontFamily: font.medium, color: colors.ink, fontSize: 13 }}>¿Tienes un código?</Text>
      <TextInput
        nativeID={inputId}
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={() => void apply()}
        placeholder="Código promocional, de amigo o de regalo"
        placeholderTextColor="#A89488"
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        accessibilityLabel="¿Tienes un código?"
        returnKeyType="done"
        style={input}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Aplicar"
        onPress={() => void apply()}
        style={({ pressed }) => [applyButton, pressed && { opacity: 0.85 }]}
      >
        <Text style={{ fontFamily: font.bold, color: colors.white, fontSize: 16 }}>Aplicar</Text>
      </Pressable>
      {banner ? <Banner tone={banner.tone} text={banner.text} /> : null}
      {chips.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {chips.map((chip) => (
            <View key={chip.kind} style={chipStyle}>
              <Text style={{ fontFamily: font.semibold, color: colors.ink, fontSize: 14 }}>{chip.label}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Quitar ${chip.code}`}
                onPress={() => remove(chip.kind)}
                style={removeButton}
              >
                <Text style={{ fontFamily: font.semibold, color: colors.bad, fontSize: 14 }}>Quitar</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const input = {
  width: "100%" as const,
  minHeight: 48,
  backgroundColor: colors.white,
  borderRadius: 14,
  borderWidth: 1,
  borderColor: colors.line,
  paddingHorizontal: 14,
  fontFamily: font.body,
  fontSize: 16,
  color: colors.ink,
};

const applyButton = {
  minHeight: 48,
  borderRadius: 14,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingHorizontal: 16,
  backgroundColor: colors.ink,
};

const chipStyle = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  backgroundColor: colors.white,
  borderRadius: 999,
  borderWidth: 1,
  borderColor: colors.line,
  paddingLeft: 12,
  minHeight: 44,
};

const removeButton = {
  minWidth: 44,
  minHeight: 44,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingHorizontal: 10,
};
