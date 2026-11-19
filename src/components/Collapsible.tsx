import { useEffect, useState, type ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Path } from "react-native-svg";
import { useReducedMotion } from "./fx";
import { colors, font } from "./theme";

export function Collapsible({
  title,
  icon,
  extra,
  badge,
  children,
  open: openProp,
  onToggle,
  headerId,
  keepMounted = false,
}: {
  title: string;
  icon?: ReactNode;
  extra?: ReactNode;
  badge?: string | null;
  children: ReactNode;
  open?: boolean;
  onToggle?: () => void;
  headerId?: string;
  /** Keep children mounted while closed so a parent can open the file picker. */
  keepMounted?: boolean;
}) {
  const reduced = useReducedMotion();
  const [uncontrolled, setUncontrolled] = useState(false);
  const open = openProp ?? uncontrolled;
  const rotation = useSharedValue(open ? 1 : 0);
  useEffect(() => {
    rotation.value = withTiming(open ? 1 : 0, { duration: reduced ? 0 : 220 });
  }, [open, reduced, rotation]);
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${rotation.value * 180}deg` }] }));
  const { lead, suffix } = optionalHeading(title);
  return (
    <Animated.View layout={reduced ? undefined : LinearTransition.duration(240)} style={[box, open ? { overflow: "visible" } : null]}>
      <View nativeID={headerId} collapsable={false}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={title}
          accessibilityState={{ expanded: open }}
          onPress={() => {
            if (onToggle) onToggle();
            else setUncontrolled((value) => !value);
          }}
          style={header}
        >
          <View style={{ flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 }}>
            {icon}
            <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
              <Text style={titleText}>
                {lead}
                {suffix ? <Text style={optionalSuffix}>{suffix}</Text> : null}
              </Text>
              {badge ? <Text style={{ fontFamily: font.medium, fontSize: 12, color: colors.pine }}>✓ {badge}</Text> : null}
            </View>
          </View>
          {extra}
          <Animated.View style={chevron}>
            <Svg width={18} height={18} viewBox="0 0 24 24">
              <Path d="M6 9l6 6 6-6" stroke={colors.ink} strokeWidth={2.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Animated.View>
        </Pressable>
      </View>
      {open ? (
        <Animated.View entering={reduced || keepMounted ? undefined : FadeIn.duration(220)} exiting={reduced || keepMounted ? undefined : FadeOut.duration(160)} style={{ paddingTop: 10 }}>
          {children}
        </Animated.View>
      ) : keepMounted ? (
        <View style={{ display: "none" }}>{children}</View>
      ) : null}
    </Animated.View>
  );
}

const OPTIONAL_SUFFIX = " (opcional)";

function optionalHeading(title: string) {
  if (!title.endsWith(OPTIONAL_SUFFIX)) return { lead: title, suffix: null };
  return { lead: title.slice(0, -OPTIONAL_SUFFIX.length), suffix: OPTIONAL_SUFFIX };
}

const box = {
  backgroundColor: colors.card,
  borderRadius: 24,
  padding: 16,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.7)",
  overflow: "hidden" as const,
};
const header = { minHeight: 44, flexDirection: "row" as const, alignItems: "center" as const, gap: 8 };
const titleText = { fontFamily: font.semibold, fontSize: 16, color: colors.ink };
const optionalSuffix = { fontFamily: font.medium, fontSize: 13, color: colors.muted };
