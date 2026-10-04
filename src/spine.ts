// "Spine background": one picture spread over the spines of every game in a
// console, so the cases standing side by side on a shelf form a single
// image. It is a console-template image layer flagged `spineBg`; its own
// geometry is meaningless — for each card it is worked out here, as the
// slice of the picture that belongs to that game's spine panel.

import { CANVAS, PANELS } from "./card";
import { findGame, getCatalog } from "./data/catalog";
import type { ImageLayer, Layer } from "./types";

export interface SpineSlice {
  index: number; // this game's position among the console's games
  count: number; // how many games the console has
}

export interface SpineRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The spine panel of the active format, full artboard height (bleed included). */
export function spineRect(): SpineRect | null {
  const p = PANELS.find((q) => q.name === "Spine");
  return p ? { x: p.x, y: 0, w: p.w, h: CANVAS.h } : null;
}

export const hasSpine = () => spineRect() !== null;

export const isSpineBg = (l: Layer): l is ImageLayer => l.type === "image" && !!l.spineBg;

/** How many spines the picture spans: the layer's own override, else one per game. */
export function spineCountOf(l: ImageLayer, slice: SpineSlice): number {
  const n = Math.round(l.spineCount ?? 0);
  return n >= 1 ? n : Math.max(1, slice.count);
}

/**
 * The layer as it appears on one card: placed exactly over the spine panel
 * and cropped to this game's slice of the picture. The picture is scaled to
 * cover a strip `count` spines wide and the artboard tall (like CSS
 * `cover`), then cut into `count` equal slices.
 */
export function resolveSpineLayer(
  l: ImageLayer,
  slice: SpineSlice,
  rect: SpineRect,
): ImageLayer {
  const count = spineCountOf(l, slice);
  const i = ((Math.round(slice.index) % count) + count) % count;
  const stripW = count * rect.w;
  const nw = Math.max(1, l.naturalWidth);
  const nh = Math.max(1, l.naturalHeight);
  const scale = Math.max(stripW / nw, rect.h / nh);
  // The part of the picture (as fractions of its natural size) that survives
  // the cover crop, positioned by the focus point.
  const visW = Math.min(1, stripW / (nw * scale));
  const visH = Math.min(1, rect.h / (nh * scale));
  const fx = Math.min(1, Math.max(0, l.spineFocus?.x ?? 0.5));
  const fy = Math.min(1, Math.max(0, l.spineFocus?.y ?? 0.5));
  const x0 = (1 - visW) * fx;
  const y0 = (1 - visH) * fy;
  const left = x0 + (visW * i) / count;
  const right = x0 + (visW * (i + 1)) / count;
  return {
    ...l,
    x: rect.x + rect.w / 2,
    y: rect.y + rect.h / 2,
    width: rect.w,
    height: rect.h,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    cornerRadius: 0,
    sizeMode: "px",
    crop: { l: left, r: 1 - right, t: y0, b: 1 - (y0 + visH) },
    locked: true, // placement is automatic — nothing to drag
  };
}

/** Resolves every spine background in a layer list for one card. */
export function applySpine(layers: Layer[], slice: SpineSlice): Layer[] {
  const rect = spineRect();
  if (!rect || !layers.some(isSpineBg)) return layers;
  return layers.map((l) => (isSpineBg(l) ? resolveSpineLayer(l, slice, rect) : l));
}

/** A game's place among its console's games (declared catalogue order). */
export function spineSliceFor(gameKey: string | undefined): SpineSlice {
  const found = findGame(gameKey);
  if (!found) return { index: 0, count: 1 };
  return {
    index: Math.max(0, found.console.games.findIndex((g) => g.id === found.game.id)),
    count: found.console.games.length,
  };
}

/** What a console template itself shows: its first spine of however many it has. */
export function spineSliceForConsole(consoleId: string | undefined): SpineSlice {
  const c = getCatalog().find((x) => x.id === consoleId);
  return { index: 0, count: c?.games.length ?? 1 };
}
