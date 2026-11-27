import { Image } from "expo-image";
import { useMemo } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { PRINT_BORDERS, PRINT_BORDER_NOTE, printBorderDataUri, type PrintBorderId } from "../lib/print-borders";
import { colors, font } from "./theme";

export const MORE_FRAMES_SOON = "Pronto tendremos más marcos.";

/** Short, honest note under every frame selector. */
export function MoreFramesSoon() {
  return (
    <Text testID="mas-marcos-nota" style={{ fontFamily: font.medium, fontSize: 13, color: colors.muted }}>
      {MORE_FRAMES_SOON}
    </Text>
  );
}

const THUMB_W = 60;
const THUMB_H = 80;

function Thumb({ id }: { id: PrintBorderId | null }) {
  const uri = useMemo(() => (id ? printBorderDataUri(id, THUMB_W * 2, THUMB_H * 2) : null), [id]);
  return (
    <View style={{ width: THUMB_W, height: THUMB_H, borderRadius: 6, overflow: "hidden", backgroundColor: "#C9B7A6" }}>
      <View style={{ position: "absolute", left: 0, right: 0, top: 0, height: THUMB_H * 0.55, backgroundColor: "#A9C1D9" }} />
      <View style={{ position: "absolute", left: THUMB_W * 0.3, top: THUMB_H * 0.38, width: THUMB_W * 0.4, height: THUMB_W * 0.4, borderRadius: 999, backgroundColor: "#E9C9A3" }} />
      {uri ? <Image source={{ uri }} contentFit="fill" style={{ position: "absolute", left: 0, top: 0, width: THUMB_W, height: THUMB_H }} /> : null}
      {id ? null : (
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: font.bold, fontSize: 20, color: "rgba(255,255,255,0.9)" }}>∅</Text>
        </View>
      )}
    </View>
  );
}

/** "Marco navideño impreso": an optional design printed on the photo itself, alongside the physical frame. */
export function PrintBorderPicker({ value, onChange }: { value: PrintBorderId | null; onChange: (next: PrintBorderId | null) => void }) {
  const options: { id: PrintBorderId | null; name: string }[] = [{ id: null, name: "Sin borde" }, ...PRINT_BORDERS];
  const chosen = PRINT_BORDERS.find((item) => item.id === value);
  return (
    <View testID="marco-navideno" style={{ gap: 8, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 }}>
      <Text accessibilityRole="header" style={{ fontFamily: font.semibold, fontSize: 16, color: colors.ink }}>Marco navideño impreso (opcional)</Text>
      <Text style={{ fontFamily: font.body, color: colors.muted }}>{PRINT_BORDER_NOTE}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }} accessibilityRole="radiogroup">
        {options.map((item) => {
          const on = item.id === value;
          return (
            <Pressable
              key={item.id ?? "none"}
              testID={`borde-${item.id ?? "ninguno"}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              accessibilityLabel={item.id ? `Marco navideño impreso ${item.name}` : "Sin borde navideño"}
              onPress={() => onChange(item.id)}
              style={{ width: 76, alignItems: "center", gap: 4, padding: 3, borderRadius: 10, borderWidth: 2, borderColor: on ? colors.red : "transparent", opacity: on ? 1 : 0.8 }}
            >
              <Thumb id={item.id} />
              <Text numberOfLines={2} style={{ fontFamily: on ? font.semibold : font.medium, fontSize: 11, color: colors.ink, textAlign: "center" }}>{item.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {chosen ? <Text testID="borde-elegido" style={{ fontFamily: font.body, fontSize: 13, color: colors.ink }}>{chosen.name}: {chosen.blurb}</Text> : null}
    </View>
  );
}
