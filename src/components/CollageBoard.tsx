import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { PanResponder, Pressable, Text, View } from "react-native";
import { backgroundHex, captionColor, panCrop, polaroidCard, type CollageBackground, type NormRect } from "../lib/collage";
import type { Crop } from "../lib/print-size";
import { resolvePhoto } from "../lib/photos";
import { colors, font } from "./theme";

export type BoardSlot = {
  photoId: string;
  crop: Crop;
  source?: { uri?: string; source?: number } | null;
};

type Drag = { from: number; over: number | null };

type PointerLike = {
  nativeEvent: { clientX: number; clientY: number; pointerId?: number };
  currentTarget?: { setPointerCapture?: (id: number) => void };
  preventDefault?: () => void;
  stopPropagation?: () => void;
};

function asPointer(event: unknown): PointerLike {
  return event as PointerLike;
}

export function CollageBoard({
  width,
  height,
  cells,
  slots,
  background,
  rounded,
  caption,
  festive,
  polaroid = false,
  selected,
  onSelect,
  onCrop,
  onSwap,
}: {
  width: number;
  height: number;
  cells: NormRect[];
  slots: BoardSlot[];
  background: CollageBackground;
  rounded: boolean;
  caption: string;
  festive: boolean;
  polaroid?: boolean;
  selected: number | null;
  onSelect: (index: number | null) => void;
  onCrop: (index: number, crop: Crop) => void;
  onSwap: (from: number, to: number) => void;
}) {
  const live = useRef({ slots, selected, onSelect, onCrop, onSwap });
  live.current = { slots, selected, onSelect, onCrop, onSwap };
  const [drag, setDrag] = useState<Drag | null>(null);
  const dragRef = useRef<Drag | null>(null);

  function moveDrag(from: number, clientX: number, clientY: number) {
    const over = slotAt(clientX, clientY);
    const next = { from, over };
    dragRef.current = next;
    setDrag(next);
  }

  function finishDrag() {
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (current && current.over != null && current.over !== current.from) live.current.onSwap(current.from, current.over);
  }

  return (
    <View style={{ width, height, backgroundColor: backgroundHex(background), overflow: "hidden" }}>
      {cells.map((cell, index) => (
        <Cell
          key={`${index}-${slots[index]?.photoId ?? "vacio"}`}
          index={index}
          cell={cell}
          slot={slots[index]}
          boardW={width}
          boardH={height}
          rounded={rounded}
          polaroid={polaroid}
          selected={selected === index}
          drop={drag != null && drag.over === index && drag.from !== index}
          onTap={() => {
            const current = live.current.selected;
            if (current == null) live.current.onSelect(index);
            else if (current === index) live.current.onSelect(null);
            else {
              live.current.onSwap(current, index);
              live.current.onSelect(null);
            }
          }}
          onCrop={(crop) => live.current.onCrop(index, crop)}
        />
      ))}
      {festive ? (
        <View
          pointerEvents="none"
          style={{
            position: "absolute",
            left: width * 0.03,
            top: height * 0.03,
            width: width * 0.94,
            height: height * 0.94,
            borderWidth: 2,
            borderColor: "#B9832F",
            borderRadius: 10,
          }}
        />
      ) : null}
      {caption ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 8, width: width - 16, bottom: Math.max(6, height * 0.02) }}>
          <Text style={{ fontFamily: font.displaySoft, fontSize: Math.max(13, height * 0.038), color: captionColor(background), textAlign: "center" }}>{caption}</Text>
        </View>
      ) : null}
      {cells.map((cell, index) => slots[index]?.photoId ? (
        <ReorderHandle
          key={`ordenar-${slots[index]?.photoId ?? index}`}
          index={index}
          cell={polaroid ? polaroidCard(cell, width, height) : cell}
          rotation={polaroid ? cell.rotation ?? 0 : 0}
          polaroid={polaroid}
          boardW={width}
          boardH={height}
          onDown={(event) => {
            event.preventDefault?.();
            event.stopPropagation?.();
            const id = event.nativeEvent.pointerId;
            if (id != null) event.currentTarget?.setPointerCapture?.(id);
            moveDrag(index, event.nativeEvent.clientX, event.nativeEvent.clientY);
          }}
          onMove={(event) => {
            if (!dragRef.current || dragRef.current.from !== index) return;
            moveDrag(index, event.nativeEvent.clientX, event.nativeEvent.clientY);
          }}
          onUp={finishDrag}
        />
      ) : null)}
    </View>
  );
}

function ReorderHandle({
  index,
  cell,
  rotation = 0,
  polaroid = false,
  boardW,
  boardH,
  onDown,
  onMove,
  onUp,
}: {
  index: number;
  cell: NormRect;
  rotation?: number;
  polaroid?: boolean;
  boardW: number;
  boardH: number;
  onDown: (event: PointerLike) => void;
  onMove: (event: PointerLike) => void;
  onUp: () => void;
}) {
  const w = cell.w * boardW;
  const h = cell.h * boardH;
  const chipW = polaroid && w < 140 ? 68 : 76;
  const chipH = 32;
  let left = cell.x * boardW + Math.max(4, w - chipW - 4);
  let top = cell.y * boardH + 4;
  if (polaroid) {
    const cx = cell.x * boardW + w / 2;
    const cy = cell.y * boardH + h / 2;
    const rad = (rotation * Math.PI) / 180;
    const ly = h / 2 - chipH / 2 - 1;
    const rx = cx - ly * Math.sin(rad);
    const ry = cy + ly * Math.cos(rad);
    left = rx - chipW / 2;
    top = ry - chipH / 2;
  }
  return (
    <View
      testID={`ordenar-${index}`}
      accessibilityRole="button"
      accessibilityLabel="Arrastra para cambiar de lugar"
          onPointerDown={(event) => onDown(asPointer(event))}
          onPointerMove={(event) => onMove(asPointer(event))}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          style={{
            position: "absolute",
            left,
            top,
            zIndex: 40,
            width: polaroid ? chipW : undefined,
            minWidth: polaroid ? chipW : 72,
            minHeight: chipH,
            paddingHorizontal: 8,
            borderRadius: 999,
            backgroundColor: "rgba(36,23,20,0.82)",
            alignItems: "center",
            justifyContent: "center",
            transform: polaroid ? [{ rotate: `${rotation}deg` }] : undefined,
            // RN's style type omits this web property. It keeps the page from scrolling while the finger moves a photo.
            ...({ touchAction: "none" } as object),
          }}
    >
      <Text style={{ color: "white", fontFamily: font.bold, fontSize: polaroid && w < 140 ? 11 : 12 }}>Ordenar</Text>
    </View>
  );
}

function Cell({
  index,
  cell,
  slot,
  boardW,
  boardH,
  rounded,
  polaroid,
  selected,
  drop,
  onTap,
  onCrop,
}: {
  index: number;
  cell: NormRect;
  slot?: BoardSlot;
  boardW: number;
  boardH: number;
  rounded: boolean;
  polaroid: boolean;
  selected: boolean;
  drop: boolean;
  onTap: () => void;
  onCrop: (crop: Crop) => void;
}) {
  const frame = polaroid ? polaroidCard(cell, boardW, boardH) : cell;
  const left = frame.x * boardW;
  const top = frame.y * boardH;
  const w = frame.w * boardW;
  const h = frame.h * boardH;
  const photoLeft = polaroid ? (cell.x - frame.x) * boardW : 0;
  const photoTop = polaroid ? (cell.y - frame.y) * boardH : 0;
  const photoW = polaroid ? cell.w * boardW : w;
  const photoH = polaroid ? cell.h * boardH : h;
  const slotRef = useRef(slot);
  slotRef.current = slot;
  const box = useRef({ w: photoW, h: photoH });
  box.current = { w: photoW, h: photoH };
  const actions = useRef({ onTap, onCrop });
  actions.current = { onTap, onCrop };
  const origin = useRef<Crop | null>(null);
  const dragged = useRef(false);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        dragged.current = false;
        origin.current = slotRef.current?.crop ?? null;
      },
      onPanResponderMove: (_event, gesture) => {
        const crop = origin.current;
        if (!crop || Math.hypot(gesture.dx, gesture.dy) < 8) return;
        dragged.current = true;
        actions.current.onCrop(panCrop(crop, gesture.dx, gesture.dy, box.current.w, box.current.h));
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;

  const image = slot?.source?.source != null ? slot.source.source : slot?.source?.uri ? { uri: slot.source.uri } : null;
  const crop = slot?.crop;
  return (
    <Pressable
      testID={`celda-${index}`}
      accessibilityLabel={`Foto ${index + 1}`}
      onPress={() => {
        if (!dragged.current) actions.current.onTap();
      }}
      {...pan.panHandlers}
      style={{
        position: "absolute",
        left,
        top,
        width: w,
        height: h,
        zIndex: polaroid ? index + 1 : 0,
        overflow: polaroid ? "visible" : "hidden",
        borderRadius: !polaroid && rounded ? Math.min(w, h) * 0.14 : 0,
        borderWidth: polaroid ? 0 : drop || selected ? 3 : 0,
        borderColor: drop ? "#B9832F" : colors.red,
        backgroundColor: polaroid ? "#FFFEFB" : drop ? "#F6E2A8" : "#E7D9CC",
        transform: polaroid ? [{ rotate: `${cell.rotation ?? 0}deg` }] : undefined,
        ...(polaroid
          ? ({
              shadowColor: "#241714",
              shadowOffset: { width: 0, height: 5 },
              shadowOpacity: 0.28,
              shadowRadius: 8,
              elevation: 6,
              boxShadow: "0 8px 16px rgba(36, 23, 20, 0.28)",
            } as object)
          : {}),
      }}
    >
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: photoLeft,
          top: photoTop,
          width: photoW,
          height: photoH,
          overflow: "hidden",
          backgroundColor: polaroid ? "#E7D9CC" : "transparent",
        }}
      >
        {image && crop ? (
          <Image
            source={image}
            pointerEvents="none"
            contentFit="fill"
            style={{
              position: "absolute",
              width: (photoW * crop.imageWidth) / crop.width,
              height: (photoH * crop.imageHeight) / crop.height,
              left: (-crop.x * photoW) / crop.width,
              top: (-crop.y * photoH) / crop.height,
            }}
          />
        ) : (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontFamily: font.semibold, color: colors.ink, textAlign: "center" }}>Foto {index + 1}</Text>
          </View>
        )}
      </View>
      <Text testID={`orden-${index}`} style={{ position: "absolute", width: 1, height: 1, opacity: 0 }}>{slot?.photoId ?? ""}</Text>
      {polaroid && (drop || selected) ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, right: 0, bottom: 0, borderWidth: 3, borderColor: drop ? "#B9832F" : colors.red }} />
      ) : null}
      {drop ? (
        <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, bottom: 8, alignItems: "center" }}>
          <Text style={{ fontFamily: font.bold, color: colors.ink, backgroundColor: "#F6E2A8", paddingHorizontal: 8, paddingVertical: 2 }}>Suelta aquí</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function slotAt(x: number, y: number): number | null {
  if (typeof document === "undefined") return null;
  const nodes = document.querySelectorAll("[data-testid^='celda-']");
  let found: number | null = null;
  nodes.forEach((node) => {
    const rect = node.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return;
    const index = Number((node.getAttribute("data-testid") || "").slice("celda-".length));
    if (!Number.isNaN(index)) found = index;
  });
  return found;
}

export function CollageStill({ photoId }: { photoId: string }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    void resolvePhoto(photoId).then((photo) => {
      if (live) setUri(photo?.uri ?? null);
    });
    return () => {
      live = false;
    };
  }, [photoId]);
  if (!uri) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  return <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="fill" />;
}
