import { openingOf, type FrameDef } from "./catalog";
import type { Orientation } from "./print-size";

export type StageRect = { x: number; y: number; w: number; h: number };

export function frameStage(frame: FrameDef, orientation: Orientation, width: number) {
  const portraitW = width;
  const portraitH = width * (frame.outerHcm / frame.outerWcm);
  const landscape = orientation === "landscape" && frame.aspect !== "1:1";
  const boxW = landscape ? portraitH : portraitW;
  const boxH = landscape ? portraitW : portraitH;
  const open = openingOf(frame);
  const local: StageRect = {
    x: open.x * portraitW,
    y: open.y * portraitH,
    w: open.w * portraitW,
    h: open.h * portraitH,
  };
  if (!landscape) return { boxW, boxH, portraitW, portraitH, landscape, opening: local };
  const frameLeft = (boxW - portraitW) / 2;
  const frameTop = (boxH - portraitH) / 2;
  const cx = boxW / 2;
  const cy = boxH / 2;
  const corners = [
    [local.x, local.y],
    [local.x + local.w, local.y],
    [local.x + local.w, local.y + local.h],
    [local.x, local.y + local.h],
  ].map(([x, y]) => {
    const px = frameLeft + x;
    const py = frameTop + y;
    const dx = px - cx;
    const dy = py - cy;
    return { x: cx - dy, y: cy + dx };
  });
  const xs = corners.map((corner) => corner.x);
  const ys = corners.map((corner) => corner.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    boxW,
    boxH,
    portraitW,
    portraitH,
    landscape,
    opening: { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY },
  };
}

export function frameWidthForBox(frame: FrameDef, orientation: Orientation, maxBoxW: number): number {
  const probe = frameStage(frame, orientation, 100);
  return (100 * maxBoxW) / probe.boxW;
}
