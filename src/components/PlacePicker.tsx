import { useEffect, useId, useLayoutEffect, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View, type ViewStyle } from "react-native";
import { colors, font } from "./theme";
import { filterPlaces, placePickerLayout, type PlacePickerLayout } from "../lib/place-picker";

type Props = {
  label: string;
  value: string;
  options: string[];
  placeholder?: string;
  disabled?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: string) => void;
  nativeID?: string;
  accessibilityLabel?: string;
};

/**
 * Department / province / district selector. The list is portaled to document.body
 * on web and anchored to the field with position:fixed, so page scroll and
 * overflow:hidden parents cannot drop it to the bottom of the document.
 */
export function PlacePicker({
  label,
  value,
  options,
  placeholder = "Elegir",
  disabled,
  open,
  onOpenChange,
  onSelect,
  nativeID,
  accessibilityLabel,
}: Props) {
  const fieldRef = useRef<ComponentRef<typeof View>>(null);
  const [layout, setLayout] = useState<PlacePickerLayout | null>(null);
  const [query, setQuery] = useState("");
  const listId = useId();
  const matches = filterPlaces(options, query);

  useLayoutEffect(() => {
    if (!open) {
      setLayout(null);
      setQuery("");
      return;
    }

    function update() {
      const node = fieldRef.current as unknown as { getBoundingClientRect?: () => DOMRect; measureInWindow?: (cb: (x: number, y: number, width: number, height: number) => void) => void } | null;
      if (node && typeof node.getBoundingClientRect === "function") {
        const rect = node.getBoundingClientRect();
        const width = typeof window !== "undefined" ? window.innerWidth : 0;
        const height = typeof window !== "undefined" ? window.innerHeight : 0;
        setLayout(
          placePickerLayout(
            { top: rect.top, bottom: rect.bottom, left: rect.left, width: rect.width },
            { width, height },
          ),
        );
        return;
      }
      node?.measureInWindow?.((x, y, width, height) => {
        const viewport = typeof window !== "undefined"
          ? { width: window.innerWidth, height: window.innerHeight }
          : { width: x + width, height: y + height };
        setLayout(
          placePickerLayout(
            { top: y, bottom: y + height, left: x, width },
            viewport,
          ),
        );
      });
    }

    update();
    if (typeof window === "undefined") return;
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  function toggle() {
    if (disabled) return;
    onOpenChange(!open);
  }

  return (
    <View ref={fieldRef} collapsable={false}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: Boolean(disabled), expanded: open }}
        accessibilityLabel={accessibilityLabel ?? (value ? `${label}, ${value}` : label)}
        nativeID={nativeID}
        disabled={disabled}
        onPress={toggle}
        style={[choice, disabled && { opacity: 0.45 }]}
      >
        <Text style={choiceLabel}>{label}</Text>
        <Text style={choiceValue}>{value || placeholder}</Text>
      </Pressable>
      {open && layout ? (
        <Portal>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar"
            onPress={() => onOpenChange(false)}
            style={backdrop}
          />
          <View
            nativeID={listId}
            accessibilityRole="list"
            style={[sheet, fixedBox(layout)]}
          >
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar"
              placeholderTextColor="#A89488"
              autoCorrect={false}
              autoFocus={Platform.OS === "web"}
              accessibilityLabel={`Buscar ${label.toLowerCase()}`}
              style={search}
            />
            <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }} nestedScrollEnabled>
              {matches.map((item) => (
                <Pressable
                  key={item}
                  accessibilityRole="button"
                  accessibilityLabel={item}
                  onPress={() => {
                    onSelect(item);
                    onOpenChange(false);
                  }}
                  style={row}
                >
                  <Text style={{ fontFamily: font.medium, fontSize: 16, color: colors.ink }}>{item}</Text>
                </Pressable>
              ))}
              {!matches.length ? (
                <Text style={{ fontFamily: font.body, color: colors.muted, paddingVertical: 12, paddingHorizontal: 14 }}>
                  No hay coincidencias.
                </Text>
              ) : null}
            </ScrollView>
          </View>
        </Portal>
      ) : null}
    </View>
  );
}

function Portal({ children }: { children: ReactNode }) {
  if (Platform.OS === "web" && typeof document !== "undefined") {
    const reactDom = require("react-dom") as { createPortal: (node: ReactNode, container: Element) => React.ReactElement };
    return reactDom.createPortal(children, document.body);
  }
  return <View style={nativeOverlay} pointerEvents="box-none">{children}</View>;
}

function fixedBox(layout: PlacePickerLayout): ViewStyle {
  return {
    position: (Platform.OS === "web" ? "fixed" : "absolute") as ViewStyle["position"],
    top: layout.top,
    left: layout.left,
    width: layout.width,
    height: layout.height,
    zIndex: 10001,
  };
}

const choice: ViewStyle = {
  minHeight: 52,
  borderRadius: 14,
  backgroundColor: colors.white,
  borderWidth: 1,
  borderColor: colors.line,
  justifyContent: "center",
  paddingHorizontal: 14,
};
const choiceLabel = { fontFamily: font.medium, color: colors.muted, fontSize: 12 };
const choiceValue = { fontFamily: font.semibold, color: colors.ink, fontSize: 16 };
const search = {
  minHeight: 48,
  borderRadius: 14,
  backgroundColor: colors.bg,
  paddingHorizontal: 14,
  fontFamily: font.body,
  fontSize: 16,
  color: colors.ink,
};
const row: ViewStyle = {
  minHeight: 48,
  justifyContent: "center",
  paddingHorizontal: 14,
  borderBottomWidth: 1,
  borderBottomColor: colors.line,
};
const sheet: ViewStyle = {
  backgroundColor: colors.white,
  borderRadius: 16,
  borderWidth: 1,
  borderColor: colors.line,
  padding: 8,
  gap: 6,
  overflow: "hidden",
  // RN Web shadow; ignored on native.
  boxShadow: "0 8px 28px rgba(36,23,20,0.18)",
} as ViewStyle;
const backdrop: ViewStyle = {
  position: (Platform.OS === "web" ? "fixed" : "absolute") as ViewStyle["position"],
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 10000,
  backgroundColor: "transparent",
};
const nativeOverlay: ViewStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: 10000,
};
