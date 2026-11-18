/** A5 portrait: half of a landscape A4 sheet (148.5 × 210 mm). */
export const A5_PANEL_RATIO = 210 / 148.5;
export const FOLD_OPEN_MS = 720;
export const FOLD_PERSPECTIVE = "1100px";
/** Room above the card so the lifted cover does not cover the chips. */
export const FOLD_LIFT = 0.92;

export function foldPreview(open: boolean, reduced: boolean) {
  return {
    durationMs: reduced ? 180 : FOLD_OPEN_MS,
    property: reduced ? "opacity" : "transform",
    rotateX: !reduced && open ? "-158deg" : "0deg",
    origin: "top center",
    perspective: FOLD_PERSPECTIVE,
    liftPxRatio: !reduced && open ? FOLD_LIFT : 0,
    frontOpacity: reduced && open ? 0 : 1,
    insideOpacity: reduced ? (open ? 1 : 0) : 1,
    hint: open ? "Toca para cerrar" : "Toca para abrir",
  };
}
