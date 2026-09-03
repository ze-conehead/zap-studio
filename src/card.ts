// Physical card spec (ISO/IEC 7810 ID-1) and derived pixel dimensions.

export const DPI = 300;
export const PX_PER_MM = DPI / 25.4;

// Portrait orientation (ID-1 rotated 90°).
export const TRIM_MM = { w: 54.0, h: 85.6 };
export const BLEED_MM = 3;
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

// Safe area: keep important content 3 mm inside the trim.
export const SAFE_MM = 3;
export const SAFE_RECT = {
  x: TRIM_RECT.x + mm(SAFE_MM),
  y: TRIM_RECT.y + mm(SAFE_MM),
  w: TRIM_RECT.w - mm(SAFE_MM) * 2,
  h: TRIM_RECT.h - mm(SAFE_MM) * 2,
};

export const CORNER_RADIUS_MM = 3.18; // ID-1 corner radius, for the preview mask only
export const CORNER_RADIUS_PX = mm(CORNER_RADIUS_MM);
