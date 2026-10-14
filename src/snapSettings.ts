// How strongly layers snap while they are dragged: the distance, in screen
// pixels, at which an edge or centre jumps onto a guide, the card or another
// layer (src/components/canvas/snapping.ts). One setting for the whole app.

import { useSyncExternalStore } from "react";

const KEY = "stickerstudio:snapStrength";

export const DEFAULT_SNAP_STRENGTH = 7;
export const MIN_SNAP_STRENGTH = 1;
export const MAX_SNAP_STRENGTH = 30;

const clamp = (v: number) => Math.min(MAX_SNAP_STRENGTH, Math.max(MIN_SNAP_STRENGTH, Math.round(v)));

const listeners = new Set<() => void>();

export function getSnapStrength(): number {
  try {
    const raw = localStorage.getItem(KEY);
    const v = raw === null ? NaN : Number(raw);
    return Number.isFinite(v) ? clamp(v) : DEFAULT_SNAP_STRENGTH;
  } catch {
    return DEFAULT_SNAP_STRENGTH;
  }
}

export function setSnapStrength(px: number): void {
  const v = clamp(px);
  try {
    if (v === DEFAULT_SNAP_STRENGTH) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, String(v));
  } catch {
    /* the choice just isn't remembered */
  }
  for (const fn of listeners) fn();
}

const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const useSnapStrength = (): number => useSyncExternalStore(subscribe, getSnapStrength, getSnapStrength);
