import { Image } from "expo-image";
import { useMemo, useRef } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { centeredCrop, type Crop } from "../lib/print-size";
import { colors, font } from "./theme";

type Box = { ox: number; oy: number; dw: number; dh: number };
type Rect = { x: number; y: number; w: number; h: number };

function imageBox(stageW: number, stageH: number, imageW: number, imageH: number): Box {
  const imageAspect = imageW / imageH;
  const stageAspect = stageW / stageH;
  if (imageAspect > stageAspect) {
    const dw = stageW;
    const dh = stageW / imageAspect;
    return { ox: 0, oy: (stageH - dh) / 2, dw, dh };
  }
  const dh = stageH;
  const dw = stageH * imageAspect;
  return { ox: (stageW - dw) / 2, oy: 0, dw, dh };
}

function cropToView(crop: Crop, box: Box): Rect {
  return {
    x: box.ox + (crop.x / crop.imageWidth) * box.dw,
    y: box.oy + (crop.y / crop.imageHeight) * box.dh,
    w: (crop.width / crop.imageWidth) * box.dw,
    h: (crop.height / crop.imageHeight) * box.dh,
  };
}

function viewToCrop(rect: Rect, box: Box, imageW: number, imageH: number): Crop {
  const width = clamp((rect.w / box.dw) * imageW, imageW * 0.18, imageW);
  const height = clamp((rect.h / box.dh) * imageH, imageH * 0.18, imageH);
  const x = clamp(((rect.x - box.ox) / box.dw) * imageW, 0, imageW - width);
  const y = clamp(((rect.y - box.oy) / box.dh) * imageH, 0, imageH - height);
  return { imageWidth: imageW, imageHeight: imageH, x, y, width, height };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function Cropper({
  source,
  crop,
  aspect,
  onChange,
  width = 320,
}: {
  source: { uri?: string; source?: number };
  crop: Crop;
  aspect: [number, number];
  onChange: (crop: Crop) => void;
  width?: number;
}) {
  const stageW = Math.max(260, Math.min(360, width));
  const stageH = Math.round(stageW * 1.05);
  const box = imageBox(stageW, stageH, crop.imageWidth, crop.imageHeight);
  const rect = cropToView(crop, box);
  const ratio = aspect[0] / aspect[1];
  const drag = useRef<{ mode: "move" | "tl" | "tr" | "bl" | "br"; rect: Rect } | null>(null);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          const x = event.nativeEvent.locationX;
          const y = event.nativeEvent.locationY;
          const handle = hitHandle(rect, x, y);
          drag.current = { mode: handle ?? "move", rect };
        },
        onPanResponderMove: (_event, gesture) => {
          const current = drag.current;
          if (!current) return;
          const next = applyGesture(current.mode, current.rect, gesture.dx, gesture.dy, ratio, box);
          onChange(viewToCrop(next, box, crop.imageWidth, crop.imageHeight));
        },
        onPanResponderRelease: () => {
          drag.current = null;
        },
      }),
    [box.dw, box.dh, box.ox, box.oy, crop.imageHeight, crop.imageWidth, onChange, ratio, rect.h, rect.w, rect.x, rect.y],
  );

  const full = centeredCrop(crop.imageWidth, crop.imageHeight, aspect[0], aspect[1]);
  const zoom = 1 - crop.width / full.width;

  return (
    <View style={{ gap: 10 }}>
      <View style={[styles.stage, { width: stageW, height: stageH }]} {...responder.panHandlers}>
        <View style={{ position: "absolute", left: box.ox, top: box.oy, width: box.dw, height: box.dh }}>
          <Image source={source.source ?? { uri: source.uri }} style={{ width: box.dw, height: box.dh }} contentFit="fill" />
        </View>
        <View pointerEvents="none" style={[styles.shade, { left: 0, top: 0, right: 0, height: rect.y }]} />
        <View pointerEvents="none" style={[styles.shade, { left: 0, top: rect.y + rect.h, right: 0, bottom: 0 }]} />
        <View pointerEvents="none" style={[styles.shade, { left: 0, top: rect.y, width: rect.x, height: rect.h }]} />
        <View pointerEvents="none" style={[styles.shade, { left: rect.x + rect.w, top: rect.y, right: 0, height: rect.h }]} />
        <View pointerEvents="none" style={[styles.crop, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }]}>
          <Handle style={{ left: -12, top: -12 }} />
          <Handle style={{ right: -12, top: -12 }} />
          <Handle style={{ left: -12, bottom: -12 }} />
          <Handle style={{ right: -12, bottom: -12 }} />
        </View>
      </View>
      <View style={styles.zoomRow}>
        <Text style={styles.zoomLabel}>Alejar</Text>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${Math.max(8, Math.min(100, zoom * 100))}%` }]} />
        </View>
        <Text style={styles.zoomLabel}>Acercar</Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable style={styles.chip} onPress={() => onChange(nudge(crop, aspect, -0.08))}>
          <Text style={styles.chipText}>−</Text>
        </Pressable>
        <Pressable style={styles.chip} onPress={() => onChange(nudge(crop, aspect, 0.08))}>
          <Text style={styles.chipText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function nudge(crop: Crop, aspect: [number, number], delta: number): Crop {
  const full = centeredCrop(crop.imageWidth, crop.imageHeight, aspect[0], aspect[1]);
  const nextWidth = clamp(crop.width * (1 - delta), full.width * 0.35, full.width);
  const nextHeight = nextWidth / (aspect[0] / aspect[1]);
  const cx = crop.x + crop.width / 2;
  const cy = crop.y + crop.height / 2;
  return {
    ...crop,
    width: nextWidth,
    height: nextHeight,
    x: clamp(cx - nextWidth / 2, 0, crop.imageWidth - nextWidth),
    y: clamp(cy - nextHeight / 2, 0, crop.imageHeight - nextHeight),
  };
}

function hitHandle(rect: Rect, x: number, y: number): "tl" | "tr" | "bl" | "br" | null {
  const spots = [
    ["tl", rect.x, rect.y],
    ["tr", rect.x + rect.w, rect.y],
    ["bl", rect.x, rect.y + rect.h],
    ["br", rect.x + rect.w, rect.y + rect.h],
  ] as const;
  for (const [name, sx, sy] of spots) {
    if (Math.abs(x - sx) < 28 && Math.abs(y - sy) < 28) return name;
  }
  return null;
}

function applyGesture(mode: "move" | "tl" | "tr" | "bl" | "br", rect: Rect, dx: number, dy: number, ratio: number, box: Box): Rect {
  if (mode === "move") {
    return {
      ...rect,
      x: clamp(rect.x + dx, box.ox, box.ox + box.dw - rect.w),
      y: clamp(rect.y + dy, box.oy, box.oy + box.dh - rect.h),
    };
  }
  const anchor = {
    tl: { x: rect.x + rect.w, y: rect.y + rect.h },
    tr: { x: rect.x, y: rect.y + rect.h },
    bl: { x: rect.x + rect.w, y: rect.y },
    br: { x: rect.x, y: rect.y },
  }[mode];
  const pointer = {
    tl: { x: rect.x + dx, y: rect.y + dy },
    tr: { x: rect.x + rect.w + dx, y: rect.y + dy },
    bl: { x: rect.x + dx, y: rect.y + rect.h + dy },
    br: { x: rect.x + rect.w + dx, y: rect.y + rect.h + dy },
  }[mode];
  let w = Math.max(48, Math.abs(pointer.x - anchor.x));
  let h = w / ratio;
  if (h > box.dh) {
    h = box.dh;
    w = h * ratio;
  }
  if (w > box.dw) {
    w = box.dw;
    h = w / ratio;
  }
  let x = pointer.x < anchor.x ? anchor.x - w : anchor.x;
  let y = pointer.y < anchor.y ? anchor.y - h : anchor.y;
  x = clamp(x, box.ox, box.ox + box.dw - w);
  y = clamp(y, box.oy, box.oy + box.dh - h);
  return { x, y, w, h };
}

function Handle({ style }: { style: object }) {
  return <View style={[styles.handle, style]} />;
}

const styles = StyleSheet.create({
  stage: { borderRadius: 20, overflow: "hidden", backgroundColor: "#E7D9CC", alignSelf: "center", maxWidth: 340 },
  shade: { position: "absolute", backgroundColor: "rgba(28,16,12,0.45)" },
  crop: { position: "absolute", borderWidth: 2, borderColor: "#fff" },
  handle: {
    position: "absolute",
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.red,
  },
  zoomRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  zoomLabel: { fontFamily: font.medium, color: colors.muted, fontSize: 12 },
  track: { flex: 1, height: 6, borderRadius: 99, backgroundColor: "#E7D6C8", overflow: "hidden" },
  fill: { height: 6, backgroundColor: colors.red },
  chip: { minWidth: 48, height: 44, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  chipText: { fontFamily: font.bold, fontSize: 20, color: colors.ink },
});
