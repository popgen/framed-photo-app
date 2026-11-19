/** A5 portrait: half of a landscape A4 sheet (148.5 × 210 mm). */
export const A5_PANEL_RATIO = 210 / 148.5;
export const FOLD_OPEN_MS = 720;
export const FOLD_PERSPECTIVE = "1100px";
/** Closed is one panel. Open lays the cover above the inside, so the sheet is twice as tall. */
export const FOLD_OPEN_TURN = "-180deg";

export function foldPreview(open: boolean, reduced: boolean) {
  return {
    durationMs: reduced ? 180 : FOLD_OPEN_MS,
    property: reduced ? "opacity" : "transform",
    rotateX: !reduced && open ? FOLD_OPEN_TURN : "0deg",
    origin: "top center",
    perspective: FOLD_PERSPECTIVE,
    liftPxRatio: open ? 1 : 0,
    sheetPanels: open ? 2 : 1,
    frontOpacity: reduced && open ? 0 : 1,
    insideOpacity: reduced ? (open ? 1 : 0) : 1,
    hint: open ? "Toca para cerrar" : "Toca para abrir",
  };
}
