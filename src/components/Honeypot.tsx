import { TextInput } from "react-native";
import { HONEYPOT_FIELD } from "../lib/contact";

export function Honeypot({ value, onChangeText }: { value: string; onChangeText: (value: string) => void }) {
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      autoComplete="off"
      autoCorrect={false}
      autoCapitalize="none"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
      nativeID={HONEYPOT_FIELD}
      pointerEvents="none"
      style={{ position: "absolute", width: 1, height: 1, opacity: 0, left: -9999 }}
    />
  );
}
