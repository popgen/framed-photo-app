import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { PanResponder, StyleSheet, Text, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";
import { openingOf, type FrameDef } from "../lib/catalog";
import { fontById, placeOverlay, type TextOverlay } from "../lib/overlay";
import { resolvePhoto } from "../lib/photos";
import type { Crop, Orientation } from "../lib/print-size";

const ART: Record<string, number> = {
  "thin-black-15": require("../../assets/frames/thin-black-15.png"),
  "thin-white-15": require("../../assets/frames/thin-white-15.png"),
  "wood-15": require("../../assets/frames/wood-15.png"),
  "thin-gold-15": require("../../assets/frames/thin-gold-15.png"),
  "black-30": require("../../assets/frames/black-30.png"),
  "white-30": require("../../assets/frames/white-30.png"),
  "wood-30": require("../../assets/frames/wood-30.png"),
  "black-mat": require("../../assets/frames/black-mat.png"),
  "wood-mat": require("../../assets/frames/wood-mat.png"),
  "square-black-20": require("../../assets/frames/square-black-20.png"),
  "nieve-celeste": require("../../assets/frames/nieve-celeste.png"),
  "acebo-clasico": require("../../assets/frames/acebo-clasico.png"),
  "estrellas-oro": require("../../assets/frames/estrellas-oro.png"),
  "retablo-ayacucho": require("../../assets/frames/retablo-ayacucho.png"),
  "aguayo-andino": require("../../assets/frames/aguayo-andino.png"),
  "noche-nevada": require("../../assets/frames/noche-nevada.png"),
  "pino-rustico": require("../../assets/frames/pino-rustico.png"),
};

export function FrameView({
  frame,
  photoId,
  crop,
  orientation = "portrait",
  width,
  overlay,
  onOverlayChange,
}: {
  frame: FrameDef;
  photoId?: string | null;
  crop?: Crop | null;
  orientation?: Orientation;
  width: number;
  overlay?: TextOverlay | null;
  onOverlayChange?: (next: TextOverlay) => void;
}) {
  const [photo, setPhoto] = useState<{ uri?: string; source?: number } | null>(null);
  useEffect(() => {
    let live = true;
    if (!photoId) {
      setPhoto(null);
      return;
    }
    resolvePhoto(photoId).then((value) => {
      if (live) setPhoto(value);
    });
    return () => {
      live = false;
    };
  }, [photoId]);

  const portraitW = width;
  const portraitH = width * (frame.outerHcm / frame.outerWcm);
  const landscape = orientation === "landscape" && frame.aspect !== "1:1";
  const boxW = landscape ? portraitH : portraitW;
  const boxH = landscape ? portraitW : portraitH;
  const open = openingOf(frame);
  const openingW = open.w * portraitW;
  const openingH = open.h * portraitH;
  const source = photo?.source ?? (photo?.uri ? { uri: photo.uri } : null);

  return (
    <View style={{ width: boxW, height: boxH + (frame.stand && !landscape ? 16 : 0), alignItems: "center" }}>
      {frame.stand && !landscape ? <View style={[styles.stand, { width: portraitW * 0.46 }]} /> : null}
      <View style={{ width: boxW, height: boxH }}>
        <View
          style={{
            width: portraitW,
            height: portraitH,
            position: "absolute",
            left: (boxW - portraitW) / 2,
            top: (boxH - portraitH) / 2,
            transform: [{ rotate: landscape ? "90deg" : "0deg" }],
            shadowColor: "#2A1B16",
            shadowOpacity: 0.22,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 12 },
          }}
        >
          <View style={[styles.opening, { left: open.x * portraitW, top: open.y * portraitH, width: openingW, height: openingH }]}>
            {source && crop ? (
              <Image
                source={source}
                contentFit="fill"
                style={{
                  position: "absolute",
                  width: (openingW * crop.imageWidth) / crop.width,
                  height: (openingH * crop.imageHeight) / crop.height,
                  left: (-crop.x * openingW) / crop.width,
                  top: (-crop.y * openingH) / crop.height,
                }}
              />
            ) : (
              <View style={styles.empty} />
            )}
            {overlay?.text ? (
              <OverlayText
                overlay={overlay}
                width={openingW}
                height={openingH}
                landscape={landscape}
                onChange={onOverlayChange}
              />
            ) : null}
            <Svg width={openingW} height={openingH} style={StyleSheet.absoluteFill} pointerEvents="none">
              <Defs>
                <LinearGradient id="glass" x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor="#ffffff" stopOpacity="0.38" />
                  <Stop offset="0.42" stopColor="#ffffff" stopOpacity="0.05" />
                  <Stop offset="1" stopColor="#ffffff" stopOpacity="0" />
                </LinearGradient>
              </Defs>
              <Rect width={openingW} height={openingH} fill="url(#glass)" />
            </Svg>
          </View>
          <Image source={ART[frame.id]} style={StyleSheet.absoluteFill} contentFit="fill" pointerEvents="none" />
        </View>
      </View>
    </View>
  );
}

function OverlayText({
  overlay,
  width,
  height,
  landscape,
  onChange,
}: {
  overlay: TextOverlay;
  width: number;
  height: number;
  landscape: boolean;
  onChange?: (next: TextOverlay) => void;
}) {
  const live = useRef({ overlay, onChange, width, height, landscape });
  live.current = { overlay, onChange, width, height, landscape };
  const family = fontById(overlay.font).family;
  const fontSize = Math.max(10, overlay.size * height);
  const origin = useRef(overlay);
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => Boolean(live.current.onChange),
      onPanResponderGrant: () => {
        origin.current = live.current.overlay;
      },
      onPanResponderMove: (_event, gesture) => move(gesture, false),
      onPanResponderRelease: (_event, gesture) => move(gesture, true),
    }),
  ).current;
  function move(gesture: { dx: number; dy: number }, snap: boolean) {
    const current = live.current;
    if (!current.onChange) return;
    const dx = current.landscape ? gesture.dy : gesture.dx;
    const dy = current.landscape ? -gesture.dx : gesture.dy;
    current.onChange(placeOverlay({ ...origin.current, x: origin.current.x + dx / current.width, y: origin.current.y + dy / current.height }, snap));
  }
  return (
    <View
      {...pan.panHandlers}
      style={{
        position: "absolute",
        left: overlay.x * width - width * 0.35,
        top: overlay.y * height - fontSize,
        width: width * 0.7,
        transform: [{ rotate: `${overlay.rotation}deg` }],
      }}
    >
      <Text style={{ fontFamily: family, fontSize, lineHeight: fontSize * 1.15, color: overlay.color, textAlign: "center", textShadowColor: "rgba(0,0,0,0.35)", textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 2 }}>
        {overlay.text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  opening: { position: "absolute", overflow: "hidden", backgroundColor: "#E7D9CC" },
  empty: { flex: 1, backgroundColor: "#E7D9CC" },
  stand: {
    position: "absolute",
    bottom: 0,
    height: 14,
    backgroundColor: "#3A2C26",
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 10,
  },
});
