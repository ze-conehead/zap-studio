// The canvas view that survives switching cards. Opening another card
// rebuilds the whole editor (the store is keyed by project id), which resets
// the canvas to fit-to-window. With "Keep view" on, the zoom and the scroll
// position are remembered here and put back on the new card.
//
// The scroll position is kept as a fraction of the scrollable range rather
// than in pixels, so it still means "the same spot" when the next card's
// layout is a bit different (a back side doubles the width, say).

import { useSyncExternalStore } from "react";

const KEEP_KEY = "stickerstudio:keepView";

let zoom = 1;
let scroll = { fx: 0, fy: 0 };
const listeners = new Set<() => void>();

export function getKeepView(): boolean {
  try {
    return localStorage.getItem(KEEP_KEY) === "1";
  } catch {
    return false;
  }
}

export function setKeepView(on: boolean): void {
  try {
    if (on) localStorage.setItem(KEEP_KEY, "1");
    else localStorage.removeItem(KEEP_KEY);
  } catch {
    /* the choice just isn't remembered */
  }
  for (const fn of listeners) fn();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const useKeepView = (): boolean => useSyncExternalStore(subscribe, getKeepView, getKeepView);

export const rememberZoom = (z: number) => {
  zoom = z;
};

export const rememberScroll = (fx: number, fy: number) => {
  scroll = { fx, fy };
};

/** Where a scrolled box is, as 0..1 of its scrollable range (0 when it can't scroll). */
export function scrollFraction(pos: number, scrollSize: number, clientSize: number): number {
  const range = scrollSize - clientSize;
  return range > 0 ? Math.min(1, Math.max(0, pos / range)) : 0;
}

/** The scroll offset that puts a box at fraction `f` of its range. */
export function scrollFromFraction(f: number, scrollSize: number, clientSize: number): number {
  return Math.max(0, scrollSize - clientSize) * f;
}

/** The remembered view when "Keep view" is on, else fit-to-window. */
export function recallView(): { zoom: number; fx: number; fy: number } {
  return getKeepView() ? { zoom, ...scroll } : { zoom: 1, fx: 0, fy: 0 };
}

// The minimap: a small overview of the card, with the visible part marked,
// while zoomed in. A plain on/off setting, remembered.
const MINIMAP_KEY = "stickerstudio:minimap";
const mapListeners = new Set<() => void>();

export function getMinimap(): boolean {
  try {
    return localStorage.getItem(MINIMAP_KEY) === "1";
  } catch {
    return false;
  }
}

export function setMinimap(on: boolean): void {
  try {
    if (on) localStorage.setItem(MINIMAP_KEY, "1");
    else localStorage.removeItem(MINIMAP_KEY);
  } catch {
    /* the choice just isn't remembered */
  }
  for (const fn of mapListeners) fn();
}

const subscribeMap = (fn: () => void) => {
  mapListeners.add(fn);
  return () => mapListeners.delete(fn);
};
export const useMinimap = (): boolean => useSyncExternalStore(subscribeMap, getMinimap, getMinimap);

/**
 * How much of a card is in view: the part of `card` that `view` covers, as
 * fractions (0..1) of the card, and whether that is all of it. Boxes are
 * { left, top, width, height } in the same (screen) space.
 */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}
export function visiblePart(card: Box, view: Box): { x: number; y: number; w: number; h: number; full: boolean } {
  if (card.width <= 0 || card.height <= 0) return { x: 0, y: 0, w: 1, h: 1, full: true };
  const x1 = Math.max(card.left, view.left);
  const y1 = Math.max(card.top, view.top);
  const x2 = Math.min(card.left + card.width, view.left + view.width);
  const y2 = Math.min(card.top + card.height, view.top + view.height);
  const w = Math.max(0, x2 - x1) / card.width;
  const h = Math.max(0, y2 - y1) / card.height;
  const tol = 1.5; // px: a hair of rounding doesn't count as "cut off"
  const full = card.width - (x2 - x1) <= tol && card.height - (y2 - y1) <= tol;
  return { x: (x1 - card.left) / card.width, y: (y1 - card.top) / card.height, w, h, full };
}

/** How far to scroll so the card point at fractions (fx, fy) lands in the middle of the view. */
export function scrollDeltaToCenter(card: Box, view: Box, fx: number, fy: number): { dx: number; dy: number } {
  return {
    dx: card.left + fx * card.width - (view.left + view.width / 2),
    dy: card.top + fy * card.height - (view.top + view.height / 2),
  };
}
