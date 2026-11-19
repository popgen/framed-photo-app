import * as Haptics from "expo-haptics";
import { useRef, useState } from "react";
import { Modal, Platform, Pressable, Text, View, type ViewStyle } from "react-native";
import Svg, { Path } from "react-native-svg";
import {
  CLEAR_PHOTOS_CANCEL,
  CLEAR_PHOTOS_CONFIRM,
  CLEAR_PHOTOS_LABEL,
  CLEAR_PHOTOS_MESSAGE,
  removeDraftKeys,
  type ForgetPlan,
} from "../lib/clear-creator";
import { forgetPhotoBlobs } from "../lib/photos";
import { useReducedMotion } from "./fx";
import { colors, font } from "./theme";

export function ClearPhotosButton({ onConfirm }: { onConfirm: () => void }) {
  const [open, setOpen] = useState(false);
  const reduced = useReducedMotion();
  const busy = useRef(false);

  function ask() {
    busy.current = false;
    setOpen(true);
    void Haptics.selectionAsync();
  }

  function cancel() {
    setOpen(false);
  }

  function confirm() {
    if (busy.current) return;
    busy.current = true;
    setOpen(false);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    onConfirm();
  }

  return (
    <>
      <Pressable
        testID="borrar-todo"
        accessibilityRole="button"
        accessibilityLabel={CLEAR_PHOTOS_LABEL}
        onPress={ask}
        style={({ pressed }) => [trigger, webPointer, pressed && { transform: [{ scale: 0.98 }] }]}
      >
        <TrashIcon />
        <Text style={triggerText}>{CLEAR_PHOTOS_LABEL}</Text>
      </Pressable>
      <Modal visible={open} transparent animationType={reduced ? "none" : "fade"} onRequestClose={cancel}>
        <Pressable accessibilityLabel={CLEAR_PHOTOS_CANCEL} onPress={cancel} style={backdrop}>
          <Pressable accessibilityRole="alert" onPress={() => {}} style={sheet}>
            <Text style={message}>{CLEAR_PHOTOS_MESSAGE}</Text>
            <View style={actions}>
              <Pressable
                testID="borrar-todo-cancelar"
                accessibilityRole="button"
                accessibilityLabel={CLEAR_PHOTOS_CANCEL}
                onPress={cancel}
                style={({ pressed }) => [action, actionGhost, webPointer, pressed && { opacity: 0.85 }]}
              >
                <Text style={actionGhostText}>{CLEAR_PHOTOS_CANCEL}</Text>
              </Pressable>
              <Pressable
                testID="borrar-todo-confirmar"
                accessibilityRole="button"
                accessibilityLabel={CLEAR_PHOTOS_CONFIRM}
                onPress={confirm}
                style={({ pressed }) => [action, actionDanger, webPointer, pressed && { opacity: 0.9 }]}
              >
                <Text style={actionDangerText}>{CLEAR_PHOTOS_CONFIRM}</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export async function forgetClearedDraft(plan: ForgetPlan): Promise<void> {
  try {
    await forgetPhotoBlobs(plan.forgetBlobIds);
  } finally {
    removeDraftKeys(plan.forgetVoiceKeys, typeof localStorage === "undefined" ? null : localStorage);
  }
}

function TrashIcon() {
  return (
    <Svg width={18} height={18} viewBox="0 0 24 24">
      <Path d="M4 7h16" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" />
      <Path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" stroke={colors.ink} strokeWidth={1.8} fill="none" strokeLinecap="round" />
      <Path d="M7 7l.8 12.2A1.5 1.5 0 0 0 9.3 20.5h5.4a1.5 1.5 0 0 0 1.5-1.3L17 7" stroke={colors.ink} strokeWidth={1.8} fill="none" strokeLinejoin="round" />
      <Path d="M10 11v6M14 11v6" stroke={colors.ink} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

const webPointer = (Platform.OS === "web" ? { cursor: "pointer" } : null) as ViewStyle;

const trigger: ViewStyle = {
  minHeight: 48,
  borderRadius: 999,
  borderWidth: 1.5,
  borderColor: colors.line,
  backgroundColor: colors.white,
  alignItems: "center",
  justifyContent: "center",
  flexDirection: "row",
  gap: 8,
  paddingHorizontal: 18,
};

const triggerText = {
  fontFamily: font.semibold,
  fontSize: 16,
  color: colors.ink,
};

const backdrop: ViewStyle = {
  flex: 1,
  backgroundColor: "rgba(36,23,20,0.45)",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const sheet: ViewStyle = {
  width: "100%",
  maxWidth: 400,
  backgroundColor: colors.card,
  borderRadius: 24,
  padding: 20,
  gap: 16,
};

const message = {
  fontFamily: font.semibold,
  fontSize: 18,
  lineHeight: 26,
  color: colors.ink,
  textAlign: "center" as const,
};

const actions: ViewStyle = {
  flexDirection: "row",
  gap: 10,
};

const action: ViewStyle = {
  flex: 1,
  minHeight: 48,
  borderRadius: 999,
  alignItems: "center",
  justifyContent: "center",
  paddingHorizontal: 12,
};

const actionGhost: ViewStyle = {
  backgroundColor: colors.white,
  borderWidth: 1.5,
  borderColor: colors.line,
};

const actionDanger: ViewStyle = {
  backgroundColor: colors.red,
};

const actionGhostText = {
  fontFamily: font.semibold,
  fontSize: 16,
  color: colors.ink,
};

const actionDangerText = {
  fontFamily: font.bold,
  fontSize: 16,
  color: colors.white,
};
