// The layer the pointer is over in the Layers panel, so the canvas can mark
// it. A tiny shared store (not props): the panel and the canvas are far apart
// in the tree, and the value changes on every mouse move across the list.

import { useSyncExternalStore } from "react";

let hovered: string | null = null;
const listeners = new Set<() => void>();

export function setHoveredLayer(id: string | null): void {
  if (hovered === id) return;
  hovered = id;
  for (const fn of listeners) fn();
}

export const subscribeHoveredLayer = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const getHoveredLayer = (): string | null => hovered;

/** The id of the layer row under the pointer, or null. */
export const useHoveredLayer = (): string | null =>
  useSyncExternalStore(subscribeHoveredLayer, getHoveredLayer, getHoveredLayer);
