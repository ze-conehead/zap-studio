// Layer effects → Konva node props. Kept tiny and separate so the renderer
// and the export path pull the exact same numbers.

import type { LayerShadow } from "./types";

export interface KonvaShadow {
  shadowColor: string;
  shadowBlur: number;
  shadowOffsetX: number;
  shadowOffsetY: number;
  shadowOpacity: number;
  shadowForStrokeEnabled: boolean;
}

/** Konva shadow props for a layer, or `undefined` when the effect is off. */
export function shadowProps(s: LayerShadow | undefined): KonvaShadow | undefined {
  if (!s?.enabled) return undefined;
  return {
    shadowColor: s.color,
    shadowBlur: Math.max(0, s.blur),
    shadowOffsetX: s.x,
    shadowOffsetY: s.y,
    shadowOpacity: Math.max(0, Math.min(1, s.opacity)),
    shadowForStrokeEnabled: true,
  };
}
