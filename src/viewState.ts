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
