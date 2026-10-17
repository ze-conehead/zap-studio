// "Fit to card": size and place a layer against the card in one click.
// Pure — the patch a layer gets; the Inspector applies it.

import { CANVAS, TRIM_RECT } from "./card";
import type { Layer } from "./types";

export type FitMode = "width" | "trim" | "bleed";

type Sized = Layer & { width: number; height: number };

export interface FitPatch {
  x?: number;
  y?: number;
  rotation: number;
  width: number;
  height: number;
}

export const canFit = (l: Layer): l is Sized =>
  (l.type === "image" || l.type === "shape" || l.type === "qr") && l.width > 0 && l.height > 0;

/**
 * - "width": as wide as the card, keeping its proportions, centred sideways;
 * - "trim" / "bleed": covers the trimmed card / the whole artboard, centred.
 *   A picture keeps its proportions (and so overhangs on one axis, like a
 *   cover fit); a shape or QR code takes the exact size.
 */
export function fitPatch(l: Sized, mode: FitMode): FitPatch {
  const box =
    mode === "bleed"
      ? { x: CANVAS.w / 2, y: CANVAS.h / 2, w: CANVAS.w, h: CANVAS.h }
      : { x: TRIM_RECT.x + TRIM_RECT.w / 2, y: TRIM_RECT.y + TRIM_RECT.h / 2, w: TRIM_RECT.w, h: TRIM_RECT.h };
  // Scale is folded into width / height (images and QR codes — see bakeScale);
  // a shape keeps whatever scale it has, so work in drawn size.
  const sx = Math.abs(l.scaleX) || 1;
  const sy = Math.abs(l.scaleY) || 1;
  const drawnW = l.width * sx;
  const drawnH = l.height * sy;

  if (mode === "width") {
    const k = box.w / drawnW;
    return { x: box.x, rotation: 0, width: l.width * k, height: l.height * k };
  }
  if (l.type === "image") {
    const k = Math.max(box.w / drawnW, box.h / drawnH);
    return { x: box.x, y: box.y, rotation: 0, width: l.width * k, height: l.height * k };
  }
  return { x: box.x, y: box.y, rotation: 0, width: box.w / sx, height: box.h / sy };
}
