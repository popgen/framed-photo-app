import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Collapsible } from "./Collapsible";
import { colors, font } from "./theme";
import { OVERLAY_COLORS, OVERLAY_FONTS, OVERLAY_SIZES, emptyOverlay, placeOverlay, textPresets, type TextOverlay } from "../lib/overlay";

export function TextStyleEditor({
  label,
  value,
  onChange,
  maxChars,
  multiline = false,
  presets = textPresets,
  collapsible = false,
  placeholder,
}: {
  label: string;
  value: TextOverlay | null;
  onChange: (next: TextOverlay | null) => void;
  maxChars: number;
  multiline?: boolean;
  presets?: string[];
  collapsible?: boolean;
  placeholder?: string;
}) {
  const userToggled = useRef(false);
  const [open, setOpen] = useState(() => Boolean(collapsible && value?.text));
  const [inputHeight, setInputHeight] = useState(96);
  const current = value ?? emptyOverlay();
  useEffect(() => {
    if (!collapsible || userToggled.current || !value?.text) return;
    setOpen(true);
  }, [collapsible, value?.text]);
  function update(partial: Partial<TextOverlay>) {
    const next = placeOverlay({ ...current, ...partial }, false, multiline);
    onChange(next.text ? { ...next, text: [...next.text].slice(0, maxChars).join("") } : null);
  }
  function toggle() {
    userToggled.current = true;
    setOpen((valueOpen) => !valueOpen);
  }
  const controls = (
    <View style={{ gap: 8 }}>
      {collapsible ? null : <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{label}</Text>}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {presets.map((preset) => (
          <Pressable key={preset} onPress={() => update({ text: preset.slice(0, maxChars) })} style={chip(current.text === preset)}>
            <Text style={chipText(current.text === preset)}>{preset}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <TextInput
        value={current.text}
        onChangeText={(text) => update({ text })}
        placeholder={placeholder ?? (multiline ? "El mensaje de adentro" : "Una frase corta")}
        placeholderTextColor="#A89488"
        multiline={multiline}
        maxLength={maxChars}
        onContentSizeChange={(event) => {
          if (!multiline) return;
          const next = Math.max(96, Math.ceil(event.nativeEvent.contentSize.height) + 8);
          setInputHeight(Math.min(next, 320));
        }}
        style={{
          minHeight: multiline ? inputHeight : 48,
          height: multiline ? inputHeight : 48,
          borderRadius: 12,
          backgroundColor: colors.white,
          padding: 12,
          fontFamily: current.text ? fontFamily(current.font) : font.body,
          color: colors.ink,
          textAlignVertical: "top",
        }}
      />
      <Text style={{ fontFamily: font.medium, color: [...current.text].length >= maxChars ? colors.bad : colors.muted }}>{[...current.text].length}/{maxChars}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {OVERLAY_FONTS.map((item) => (
          <Pressable key={item.id} onPress={() => update({ font: item.id })} style={chip(current.font === item.id)}>
            <Text style={{ ...chipText(current.font === item.id), fontFamily: item.family }}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {OVERLAY_SIZES.map((item) => (
          <Pressable key={item.id} onPress={() => update({ size: item.size })} style={chip(Math.abs(current.size - item.size) < 0.01)}>
            <Text style={chipText(Math.abs(current.size - item.size) < 0.01)}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {OVERLAY_COLORS.map((color) => (
          <Pressable key={color} onPress={() => update({ color })} accessibilityLabel={color} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: color, borderWidth: current.color === color ? 3 : 1, borderColor: current.color === color ? colors.ink : colors.line }} />
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        <Pressable onPress={() => update({ x: current.x - 0.08 })} style={chip(false)}><Text style={chipText(false)}>←</Text></Pressable>
        <Pressable onPress={() => update({ x: current.x + 0.08 })} style={chip(false)}><Text style={chipText(false)}>→</Text></Pressable>
        <Pressable onPress={() => update({ y: current.y - 0.08 })} style={chip(false)}><Text style={chipText(false)}>↑</Text></Pressable>
        <Pressable onPress={() => update({ y: current.y + 0.08 })} style={chip(false)}><Text style={chipText(false)}>↓</Text></Pressable>
        <Pressable onPress={() => update({ x: 0.5, y: multiline ? 0.5 : 0.72 })} style={chip(false)}>
          <Text style={chipText(false)}>Centrar</Text>
        </Pressable>
        <Pressable onPress={() => onChange(null)} style={chip(false)}>
          <Text style={chipText(false)}>Quitar</Text>
        </Pressable>
      </View>
    </View>
  );
  if (!collapsible) return controls;
  return (
    <Collapsible title="Agrega texto a tu foto" open={open} onToggle={toggle}>
      {controls}
    </Collapsible>
  );
}

function fontFamily(id: string) {
  return OVERLAY_FONTS.find((item) => item.id === id)?.family ?? font.body;
}

function chip(on: boolean) {
  return { minHeight: 44, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center" as const, backgroundColor: on ? colors.ink : colors.white, borderWidth: 1, borderColor: colors.line };
}
function chipText(on: boolean) {
  return { fontFamily: font.semibold, color: on ? "white" : colors.ink };
}
