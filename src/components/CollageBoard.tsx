import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { PanResponder, Pressable, Text, View } from "react-native";
import { backgroundHex, captionColor, panCrop, type CollageBackground, type NormRect } from "../lib/collage";
import type { Crop } from "../lib/print-size";
import { resolvePhoto } from "../lib/photos";
import { colors, font } from "./theme";

export type BoardSlot = {
  photoId: string;
  crop: Crop;
  source?: { uri?: string; source?: number } | null;
};

export function CollageBoard({
  width,
  height,
  cells,
  slots,
  background,
  rounded,
  caption,
  festive,
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
  selected: number | null;
  onSelect: (index: number | null) => void;
  onCrop: (index: number, crop: Crop) => void;
  onSwap: (from: number, to: number) => void;
}) {
  const live = useRef({ slots, selected, onSelect, onCrop, onSwap });
  live.current = { slots, selected, onSelect, onCrop, onSwap };

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
          selected={selected === index}
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
  selected,
  onTap,
  onCrop,
}: {
  index: number;
  cell: NormRect;
  slot?: BoardSlot;
  boardW: number;
  boardH: number;
  rounded: boolean;
  selected: boolean;
  onTap: () => void;
  onCrop: (crop: Crop) => void;
}) {
  const left = cell.x * boardW;
  const top = cell.y * boardH;
  const w = cell.w * boardW;
  const h = cell.h * boardH;
  const slotRef = useRef(slot);
  slotRef.current = slot;
  const box = useRef({ w, h });
  box.current = { w, h };
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
        overflow: "hidden",
        borderRadius: rounded ? Math.min(w, h) * 0.14 : 0,
        borderWidth: selected ? 3 : 0,
        borderColor: colors.red,
        backgroundColor: "#E7D9CC",
      }}
    >
      {image && crop ? (
        <Image
          source={image}
          pointerEvents="none"
          contentFit="fill"
          style={{
            position: "absolute",
            width: (w * crop.imageWidth) / crop.width,
            height: (h * crop.imageHeight) / crop.height,
            left: (-crop.x * w) / crop.width,
            top: (-crop.y * h) / crop.height,
          }}
        />
      ) : (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ fontFamily: font.semibold, color: colors.ink }}>{index + 1}</Text>
        </View>
      )}
    </Pressable>
  );
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
