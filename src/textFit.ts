// Text measurement, shared by the canvas renderer and the preflight check so
// both see the same numbers. Everything is measured with an off-stage
// Konva.Text, which uses the font's real metrics — the same code path that
// draws the layer.

import Konva from "konva";
import { DEFAULT_FLOW_HEIGHT } from "./textFlow";
import { fontStyleString } from "./textUtil";
import type { TextLayer } from "./types";

/** Auto-fit never shrinks past this, however long the text is. */
export const MIN_AUTO_FIT = 6;

function probeFor(layer: TextLayer): Konva.Text {
  return new Konva.Text({
    text: layer.text,
    width: layer.width,
    fontFamily: layer.fontFamily,
    fontStyle: fontStyleString(layer),
    lineHeight: layer.lineHeight,
    letterSpacing: layer.letterSpacing,
    align: layer.align,
  });
}

/**
 * Largest size at or below `layer.fontSize` whose wrapped text still fits
 * `lines` lines.
 */
export function fitFontSize(layer: TextLayer, lines: number): number {
  const probe = probeFor(layer);
  for (let size = Math.round(layer.fontSize); size >= MIN_AUTO_FIT; size--) {
    probe.fontSize(size);
    // +0.5 absorbs the sub-pixel rounding in Konva's line metrics.
    if (probe.height() <= size * layer.lineHeight * lines + 0.5) return size;
  }
  return MIN_AUTO_FIT;
}

/**
 * The size the layer actually draws at — auto-fit applied if it is on.
 * Auto-fit measures plain wrapping, so a flowing frame (src/textFlow.ts)
 * keeps its set size.
 */
export const renderedFontSize = (layer: TextLayer): number =>
  layer.autoFit && !layer.flow
    ? fitFontSize(layer, Math.max(1, layer.autoFitLines ?? 2))
    : layer.fontSize;

/** Height of the wrapped text at its rendered size, in canvas px. */
export function textHeight(layer: TextLayer): number {
  if (layer.flow) return layer.height ?? DEFAULT_FLOW_HEIGHT;
  const probe = probeFor(layer);
  probe.fontSize(renderedFontSize(layer));
  return probe.height();
}
