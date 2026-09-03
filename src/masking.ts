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

// Index of the layer that would clip `layer` if it were marked clipped:
// the mask layer immediately above it in the stack. -1 when none.
export function maskAbove(layers: Layer[], index: number): number {
  const above = layers[index + 1];
  return above && above.mask ? index + 1 : -1;
}
