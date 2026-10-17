// The colours a card already uses, for the colour fields to offer again — so
// a text can take exactly the red of the shape beside it. Plain #rrggbb
// values found anywhere in the face's layers (fills, gradient stops, strokes,
// text, shadows …), most used first.

import type { Layer } from "./types";

const HEX = /^#[0-9a-f]{6}$/i;

export function colorsOnCard(layers: Layer[], max = 14): string[] {
  const count = new Map<string, number>();
  const walk = (v: unknown, key?: string) => {
    if (typeof v === "string") {
      if (HEX.test(v) && key !== "src") {
        const c = v.toLowerCase();
        count.set(c, (count.get(c) ?? 0) + 1);
      }
    } else if (Array.isArray(v)) {
      for (const x of v) walk(x);
    } else if (v && typeof v === "object") {
      for (const [k, x] of Object.entries(v)) {
        if (k === "src") continue; // picture data, never a colour
        walk(x, k);
      }
    }
  };
  for (const l of layers) walk(l);
  return [...count.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([c]) => c);
}
