// Where a layer sits on the card, in canvas px — shared by the preflight
// checks and the contrast colour (src/contrast.ts).

import { textHeight } from "./textFit";
import type { Layer } from "./types";

export interface Box {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** A layer's drawn size in canvas px (its scale applied, rotation not); null for one with no box of its own. */
export function layerSize(l: Layer): { w: number; h: number } | null {
  let w: number;
  let h: number;
  if (l.type === "text") {
    w = l.width;
    h = textHeight(l);
  } else if ("width" in l && "height" in l) {
    w = l.width;
    h = l.height;
  } else {
    return null;
  }
  w = Math.abs(w * l.scaleX);
  h = Math.abs(h * l.scaleY);
  return w && h ? { w, h } : null;
}

/** Axis-aligned bounds of a layer in canvas px, rotation included. */
export function bounds(l: Layer): Box | null {
  const size = layerSize(l);
  if (!size) return null;
  const { w, h } = size;
  if (!l.rotation) {
    return { x1: l.x - w / 2, y1: l.y - h / 2, x2: l.x + w / 2, y2: l.y + h / 2 };
  }
  const r = (l.rotation * Math.PI) / 180;
  const cw = (Math.abs(Math.cos(r)) * w + Math.abs(Math.sin(r)) * h) / 2;
  const ch = (Math.abs(Math.sin(r)) * w + Math.abs(Math.cos(r)) * h) / 2;
  return { x1: l.x - cw, y1: l.y - ch, x2: l.x + cw, y2: l.y + ch };
}
