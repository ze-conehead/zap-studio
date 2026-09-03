import type { Layer } from "./types";

// A contiguous run of layers that share one Konva layer canvas.
// "mask" segments end with a mask layer whose alpha clips the layers before it
// (via globalCompositeOperation "destination-in" on its own canvas).
export type RenderSegment =
  | { kind: "plain"; layers: Layer[] }
  | { kind: "mask"; clipped: Layer[]; mask: Layer };

export function segmentLayers(layers: Layer[]): RenderSegment[] {
  const segments: RenderSegment[] = [];
  let pendingClipped: Layer[] = [];
  let plain: Layer[] = [];

  const flushPlain = () => {
    if (plain.length) {
      segments.push({ kind: "plain", layers: plain });
      plain = [];
    }
  };

  for (const layer of layers) {
    if (layer.mask) {
      flushPlain();
      segments.push({ kind: "mask", clipped: pendingClipped, mask: layer });
      pendingClipped = [];
    } else if (layer.clipped) {
      // A clipped layer only clips if a mask follows it; buffer until we know.
      pendingClipped.push(layer);
    } else {
      // Orphan clipped layers (no mask above) render as plain.
      if (pendingClipped.length) {
        plain.push(...pendingClipped);
        pendingClipped = [];
      }
      plain.push(layer);
    }
  }
  if (pendingClipped.length) plain.push(...pendingClipped);
  flushPlain();
  return segments;
}

// True when the layer at `index` sits in the clipped run directly below a mask
// (so it may be toggled `clipped`).
export function canBeClipped(layers: Layer[], index: number): boolean {
  let j = index + 1;
  while (j < layers.length && layers[j].clipped && !layers[j].mask) j++;
  return j < layers.length && !!layers[j].mask;
}

// The contiguous clipped run below the mask at `maskIndex`: children are
// layers[start .. maskIndex-1].
export function maskGroupStart(layers: Layer[], maskIndex: number): number {
  let start = maskIndex;
  while (start - 1 >= 0 && layers[start - 1].clipped && !layers[start - 1].mask) {
    start--;
  }
  return start;
}
