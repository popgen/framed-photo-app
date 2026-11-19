import { Image } from "expo-image";
import { useRef } from "react";
import { GestureResponderEvent, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import { centeredCrop, type Crop } from "../lib/print-size";
import { colors, font } from "./theme";

type Box = { ox: number; oy: number; dw: number; dh: number };
type Rect = { x: number; y: number; w: number; h: number };
type Handle = "tl" | "tr" | "bl" | "br";
type Mode = "move" | Handle | "pinch";

/** How far the crop can shrink, as a share of the largest crop that fits. */
const MIN_ZOOM_SCALE = 0.35;

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

/** Resize the crop around its own centre, keeping the print aspect. */
function cropAtWidth(crop: Crop, aspect: [number, number], width: number): Crop {
  const full = centeredCrop(crop.imageWidth, crop.imageHeight, aspect[0], aspect[1]);
  const nextWidth = clamp(width, full.width * MIN_ZOOM_SCALE, full.width);
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

/** 0 = the whole photo, 1 = as close as the crop goes. */
function zoomFraction(crop: Crop, aspect: [number, number]): number {
  const full = centeredCrop(crop.imageWidth, crop.imageHeight, aspect[0], aspect[1]);
  const span = full.width * (1 - MIN_ZOOM_SCALE);
  if (span <= 0) return 0;
  return clamp((full.width - crop.width) / span, 0, 1);
}

function cropAtZoom(crop: Crop, aspect: [number, number], fraction: number): Crop {
  const full = centeredCrop(crop.imageWidth, crop.imageHeight, aspect[0], aspect[1]);
  return cropAtWidth(crop, aspect, full.width - clamp(fraction, 0, 1) * full.width * (1 - MIN_ZOOM_SCALE));
}

function touchDistance(event: GestureResponderEvent): number {
  const touches = event.nativeEvent.touches;
  if (!touches || touches.length < 2) return 0;
  const [a, b] = touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
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

  // Everything the gesture handlers need, refreshed each render. Keeping it in a
  // ref means the PanResponder is built once and never reads a stale crop — the
  // dependency list it used to carry was easy to get wrong.
  const live = useRef({ crop, box, rect, ratio, aspect, onChange });
  live.current = { crop, box, rect, ratio, aspect, onChange };
  const drag = useRef<{ mode: Mode; rect: Rect; width: number; distance: number } | null>(null);

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        const current = live.current;
        const distance = touchDistance(event);
        if (distance > 0) {
          drag.current = { mode: "pinch", rect: current.rect, width: current.crop.width, distance };
          return;
        }
        // locationX/locationY are relative to the element the touch landed on, so
        // the handlers live on one overlay that covers the whole stage. Reading
        // them off the photo instead would offset every hit test by the
        // letterboxing, which made the corner handles hard to grab.
        const x = event.nativeEvent.locationX;
        const y = event.nativeEvent.locationY;
        drag.current = { mode: hitHandle(current.rect, x, y) ?? "move", rect: current.rect, width: current.crop.width, distance: 0 };
      },
      onPanResponderMove: (event, gesture) => {
        const held = drag.current;
        const current = live.current;
        if (!held) return;
        if (held.mode === "pinch") {
          const distance = touchDistance(event);
          if (distance <= 0 || held.distance <= 0) return;
          current.onChange(cropAtWidth(current.crop, current.aspect, held.width / (distance / held.distance)));
          return;
        }
        const next = applyGesture(held.mode, held.rect, gesture.dx, gesture.dy, current.ratio, current.box);
        current.onChange(viewToCrop(next, current.box, current.crop.imageWidth, current.crop.imageHeight));
      },
      onPanResponderRelease: () => {
        drag.current = null;
      },
      onPanResponderTerminate: () => {
        drag.current = null;
      },
    }),
  ).current;

  const fraction = zoomFraction(crop, aspect);

  return (
    <View style={{ gap: 10 }}>
      <View style={[styles.stage, { width: stageW, height: stageH }]}>
        <View style={{ position: "absolute", left: box.ox, top: box.oy, width: box.dw, height: box.dh }}>
          <Image source={source.source ?? { uri: source.uri }} style={{ width: box.dw, height: box.dh }} contentFit="fill" />
        </View>
        <View pointerEvents="none" style={[styles.shade, { left: 0, top: 0, right: 0, height: rect.y }]} />
        <View pointerEvents="none" style={[styles.shade, { left: 0, top: rect.y + rect.h, right: 0, bottom: 0 }]} />
        <View pointerEvents="none" style={[styles.shade, { left: 0, top: rect.y, width: rect.x, height: rect.h }]} />
        <View pointerEvents="none" style={[styles.shade, { left: rect.x + rect.w, top: rect.y, right: 0, height: rect.h }]} />
        <View pointerEvents="none" style={[styles.crop, { left: rect.x, top: rect.y, width: rect.w, height: rect.h }]}>
          <Corner style={{ left: -13, top: -13 }} />
          <Corner style={{ right: -13, top: -13 }} />
          <Corner style={{ left: -13, bottom: -13 }} />
          <Corner style={{ right: -13, bottom: -13 }} />
        </View>
        <View
          style={StyleSheet.absoluteFill}
          accessibilityLabel="Arrastra para mover el recorte, pellizca para acercar"
          {...responder.panHandlers}
        />
      </View>

      <ZoomSlider
        width={stageW}
        fraction={fraction}
        onFraction={(next) => onChange(cropAtZoom(crop, aspect, next))}
      />

      <View style={{ flexDirection: "row", gap: 8, alignSelf: "center" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Alejar"
          style={styles.chip}
          onPress={() => onChange(cropAtZoom(crop, aspect, fraction - 0.1))}
        >
          <Text style={styles.chipText}>−</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Acercar"
          style={styles.chip}
          onPress={() => onChange(cropAtZoom(crop, aspect, fraction + 0.1))}
        >
          <Text style={styles.chipText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * A real slider. The old one drew the same bar but had no touch handling at all,
 * so it looked draggable and did nothing.
 */
function ZoomSlider({ width, fraction, onFraction }: { width: number; fraction: number; onFraction: (next: number) => void }) {
  const labelW = 52;
  const trackW = Math.max(80, width - labelW * 2 - 16);
  const live = useRef({ trackW, onFraction });
  live.current = { trackW, onFraction };

  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (event) => {
        live.current.onFraction(clamp(event.nativeEvent.locationX / live.current.trackW, 0, 1));
      },
      onPanResponderMove: (event) => {
        live.current.onFraction(clamp(event.nativeEvent.locationX / live.current.trackW, 0, 1));
      },
    }),
  ).current;

  return (
    <View style={styles.zoomRow}>
      <Text style={[styles.zoomLabel, { width: labelW }]}>Alejar</Text>
      <View
        accessibilityRole="adjustable"
        accessibilityLabel="Acercar o alejar la foto"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
        style={[styles.touchTrack, { width: trackW }]}
        {...responder.panHandlers}
      >
        <View pointerEvents="none" style={styles.track}>
          <View style={[styles.fill, { width: `${fraction * 100}%` }]} />
        </View>
        <View pointerEvents="none" style={[styles.knob, { left: clamp(fraction * trackW - 14, 0, trackW - 28) }]} />
      </View>
      <Text style={[styles.zoomLabel, { width: labelW, textAlign: "right" }]}>Acercar</Text>
    </View>
  );
}

function hitHandle(rect: Rect, x: number, y: number): Handle | null {
  const spots = [
    ["tl", rect.x, rect.y],
    ["tr", rect.x + rect.w, rect.y],
    ["bl", rect.x, rect.y + rect.h],
    ["br", rect.x + rect.w, rect.y + rect.h],
  ] as const;
  let best: Handle | null = null;
  let bestDistance = Infinity;
  for (const [name, sx, sy] of spots) {
    const distance = Math.hypot(x - sx, y - sy);
    // A finger pad is about 9mm, so grab the nearest corner within ~32px rather
    // than the first one whose box the touch happens to fall in.
    if (distance < 32 && distance < bestDistance) {
      best = name;
      bestDistance = distance;
    }
  }
  return best;
}

function applyGesture(mode: Exclude<Mode, "pinch">, rect: Rect, dx: number, dy: number, ratio: number, box: Box): Rect {
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

function Corner({ style }: { style: object }) {
  return <View style={[styles.handle, style]} />;
}

const styles = StyleSheet.create({
  stage: { borderRadius: 20, overflow: "hidden", backgroundColor: "#E7D9CC", alignSelf: "center", maxWidth: 340 },
  shade: { position: "absolute", backgroundColor: "rgba(28,16,12,0.45)" },
  crop: { position: "absolute", borderWidth: 2, borderColor: "#fff" },
  handle: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.red,
  },
  zoomRow: { flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "center" },
  zoomLabel: { fontFamily: font.medium, color: colors.muted, fontSize: 12 },
  // 44px tall so the whole strip is a touch target, not just the 6px bar.
  touchTrack: { height: 44, justifyContent: "center" },
  track: { height: 6, borderRadius: 99, backgroundColor: "#E7D6C8", overflow: "hidden" },
  fill: { height: 6, backgroundColor: colors.red },
  knob: {
    position: "absolute",
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.white,
    borderWidth: 3,
    borderColor: colors.red,
  },
  chip: { minWidth: 56, height: 44, paddingHorizontal: 16, borderRadius: 14, backgroundColor: colors.white, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  chipText: { fontFamily: font.bold, fontSize: 20, color: colors.ink },
});
