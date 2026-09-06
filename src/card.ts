// Physical spec of the active sticker format and derived pixel dimensions.
// The format is fixed for the session (see src/formats.ts), so these stay
// plain module-level constants.

import { getFormat } from "./formats";

const FMT = getFormat();

export const DPI = 300;
export const PX_PER_MM = DPI / 25.4;

// Trim size of the active format (portrait for the card).
export const TRIM_MM = { ...FMT.trimMM };
export const BLEED_MM = FMT.bleedMM;
export const MARKS_MARGIN_MM = 5; // white margin around bleed that holds the crop marks

const mm = (v: number) => Math.round(v * PX_PER_MM);

// The editor canvas = trim + bleed on every side.
export const CANVAS = {
  w: mm(TRIM_MM.w + BLEED_MM * 2),
  h: mm(TRIM_MM.h + BLEED_MM * 2),
};

export const BLEED_PX = mm(BLEED_MM);
export const MARKS_MARGIN_PX = mm(MARKS_MARGIN_MM);

// Trim rectangle inside the canvas.
export const TRIM_RECT = {
  x: BLEED_PX,
  y: BLEED_PX,
  w: mm(TRIM_MM.w),
  h: mm(TRIM_MM.h),
};

export const CORNER_RADIUS_MM = FMT.cornerRadiusMM; // for the preview mask only
export const CORNER_RADIUS_PX = mm(CORNER_RADIUS_MM);

// Multi-panel formats (DVD wrap / J-card): panel rectangles in canvas px,
// left-to-right across the trim. Empty for single-panel formats.
export interface CanvasPanel {
  name: string; // i18n key
  x: number;
  w: number;
}
export const PANELS: CanvasPanel[] = (() => {
  if (!FMT.panels) return [];
  const out: CanvasPanel[] = [];
  let x = TRIM_RECT.x;
  FMT.panels.forEach((p, i) => {
    const last = i === FMT.panels!.length - 1;
    const w = last ? TRIM_RECT.x + TRIM_RECT.w - x : mm(p.wMM);
    out.push({ name: p.name, x, w });
    x += w;
  });
  return out;
})();

// x of every internal fold (panel boundary).
export const FOLD_X: number[] = PANELS.slice(1).map((p) => p.x);

