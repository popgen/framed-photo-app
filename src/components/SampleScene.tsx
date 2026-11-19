import { Image } from "expo-image";
import { useEffect, useState } from "react";
import { Platform, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Ellipse, Path } from "react-native-svg";
import { useReducedMotion } from "./fx";

const BACKGROUND = require("../../assets/scenes/machu-picchu-bg.jpg");
const STILL = require("../../assets/sample-memory.png");

const MOTION = `
@keyframes mifotito-zoom {
  from { transform: scale(1); }
  to { transform: scale(1.06); }
}
@keyframes mifotito-mist {
  from { transform: translate3d(-14%, 0, 0); }
  to { transform: translate3d(14%, 0, 0); }
}
@keyframes mifotito-bird {
  0% { transform: translate3d(-8%, 6px, 0); }
  40% { transform: translate3d(38%, -18px, 0); }
  100% { transform: translate3d(96%, 4px, 0); }
}
@keyframes mifotito-flap {
  from { transform: scaleY(1); }
  to { transform: scaleY(0.3); }
}
@keyframes mifotito-walk {
  0%, 18% { transform: translate3d(0, 0, 0) scaleX(1); }
  46%, 60% { transform: translate3d(130%, 0, 0) scaleX(1); }
  64%, 78% { transform: translate3d(130%, 0, 0) scaleX(-1); }
  100% { transform: translate3d(0, 0, 0) scaleX(-1); }
}
@keyframes mifotito-step {
  from { transform: rotate(8deg); }
  to { transform: rotate(-8deg); }
}
@keyframes mifotito-graze {
  0%, 72%, 100% { transform: rotate(0deg); }
  80%, 88% { transform: rotate(16deg); }
}
`;

type Play = "paused" | "running";

function move(name: string, duration: string, play: Play, extra?: Record<string, string>): ViewStyle {
  return {
    animationName: name,
    animationDuration: duration,
    animationTimingFunction: "ease-in-out",
    animationIterationCount: "infinite",
    animationPlayState: play,
    ...extra,
  } as ViewStyle;
}

export function SampleScene({ style }: { style: StyleProp<ViewStyle> }) {
  const reduced = useReducedMotion();
  if (reduced || Platform.OS !== "web") {
    return <Image source={STILL} contentFit="fill" style={style as never} pointerEvents="none" />;
  }
  return <LiveScene style={style} />;
}

function LiveScene({ style }: { style: StyleProp<ViewStyle> }) {
  const [playing, setPlaying] = useState(true);
  const play: Play = playing ? "running" : "paused";

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!document.getElementById("mifotito-scene")) {
      const sheet = document.createElement("style");
      sheet.id = "mifotito-scene";
      sheet.textContent = MOTION;
      document.head.appendChild(sheet);
    }
    const node = document.getElementById("mifotito-sample-scene");
    if (!node || typeof IntersectionObserver === "undefined") return;
    const watcher = new IntersectionObserver(([entry]) => setPlaying(entry.isIntersecting), { threshold: 0.15 });
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);

  return (
    <View nativeID="mifotito-sample-scene" pointerEvents="none" style={style}>
      <View style={[{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }, move("mifotito-zoom", "26s", play, { animationDirection: "alternate", transformOrigin: "center" })]}>
        <Image source={BACKGROUND} contentFit="fill" style={{ width: "100%", height: "100%" }} />
      </View>
      <Mist top="36%" width="120%" height="7%" color="rgba(255,244,230,0.28)" duration="36s" delay="-8s" play={play} />
      <Mist top="46%" width="130%" height="8%" color="rgba(255,226,204,0.24)" duration="46s" delay="-20s" play={play} />
      <Mist top="56%" width="110%" height="6%" color="rgba(255,236,220,0.2)" duration="32s" delay="-12s" play={play} />
      <Bird top="8%" delay="-5s" duration="23s" size={22} play={play} />
      <Bird top="15%" delay="-16s" duration="28s" size={16} play={play} />
      <Bird top="22%" delay="-9s" duration="34s" size={13} play={play} />
      <Llama play={play} />
    </View>
  );
}

function Mist({ top, width, height, color, duration, delay, play }: { top: string; width: string; height: string; color: string; duration: string; delay: string; play: Play }) {
  return (
    <View
      style={{
        position: "absolute",
        top,
        left: "-6%",
        width,
        height,
        borderRadius: 999,
        backgroundColor: color,
        filter: "blur(8px)",
        ...move("mifotito-mist", duration, play, { animationDirection: "alternate", animationDelay: delay }),
      }}
    />
  );
}

function Bird({ top, delay, duration, size, play }: { top: string; delay: string; duration: string; size: number; play: Play }) {
  return (
    <View style={[{ position: "absolute", top, left: 0, width: "100%" }, move("mifotito-bird", duration, play, { animationTimingFunction: "linear", animationDelay: delay })]}>
      <View style={[{ width: size, transformOrigin: "center" }, move("mifotito-flap", "0.52s", play, { animationDirection: "alternate" })]}>
        <Svg width={size} height={Math.round(size * 0.55)} viewBox="0 0 40 22">
          <Path d="M2 16 Q10 2 20 12 Q30 2 38 16" stroke="#2A241C" strokeWidth="2.4" fill="none" strokeLinecap="round" />
        </Svg>
      </View>
    </View>
  );
}

function Llama({ play }: { play: Play }) {
  return (
    <View style={{ position: "absolute", left: "62%", top: "66%", width: "18%", aspectRatio: 0.78, transformOrigin: "center bottom", ...move("mifotito-walk", "32s", play) }}>
      <Svg width="100%" height="100%" viewBox="0 0 48 40">
        <Ellipse cx="26" cy="24" rx="15" ry="9" fill="#3A2C38" />
        <Path d="M34 20 C38 12 36 8 33 5 C36 7 39 11 38 16 Z" fill="#3A2C38" />
      </Svg>
      <View style={{ position: "absolute", left: "46%", top: "-18%", width: "34%", transformOrigin: "60% 80%", ...move("mifotito-graze", "11s", play) }}>
        <Svg width="100%" height="100%" viewBox="0 0 24 20">
          <Ellipse cx="12" cy="12" rx="5" ry="4" fill="#3A2C38" />
          <Path d="M9 8 L11 1 L14 8" fill="#3A2C38" />
          <Path d="M14 10 C20 6 22 12 16 14" fill="#3A2C38" />
        </Svg>
      </View>
      <View style={{ position: "absolute", left: "8%", bottom: "-8%", width: "78%", height: "46%", transformOrigin: "center top", ...move("mifotito-step", "1.15s", play, { animationDirection: "alternate" }) }}>
        <Svg width="100%" height="100%" viewBox="0 0 40 24">
          <Path d="M6 2 L4 22" stroke="#3A2C38" strokeWidth="3" strokeLinecap="round" />
          <Path d="M14 2 L16 22" stroke="#3A2C38" strokeWidth="3" strokeLinecap="round" />
          <Path d="M24 2 L26 22" stroke="#3A2C38" strokeWidth="3" strokeLinecap="round" />
          <Path d="M33 2 L35 22" stroke="#3A2C38" strokeWidth="3" strokeLinecap="round" />
        </Svg>
      </View>
    </View>
  );
}
