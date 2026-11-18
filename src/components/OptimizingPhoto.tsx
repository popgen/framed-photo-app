import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { subscribeOptimizing } from "../lib/photos";
import { colors, font } from "./theme";

export function OptimizingPhoto() {
  const [active, setActive] = useState(false);
  const pulse = useSharedValue(0.45);
  useEffect(() => subscribeOptimizing(setActive), []);
  useEffect(() => {
    if (!active) return;
    pulse.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [active, pulse]);
  const style = useAnimatedStyle(() => ({ opacity: pulse.value }));
  if (!active) return null;
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: 16, right: 16, top: 72, zIndex: 8, alignItems: "center" }}>
      <Animated.View style={[{ backgroundColor: colors.ink, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 }, style]}>
        <Text style={{ color: "white", fontFamily: font.semibold }}>Optimizando tu foto…</Text>
      </Animated.View>
    </View>
  );
}
