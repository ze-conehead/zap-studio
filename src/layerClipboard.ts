// "Copy" / "Paste" a whole layer — every property, not just its look (see
// src/layerStyle.ts for that). One in-memory clipboard for the session, so
// a shape (or anything else) copied from one console's template can be
// pasted straight into another console's, or onto a card, with everything
// — including a compound shape's `combine` entries — carried over intact.
// A maskId / condId that doesn't resolve in the new context is left as-is;
// it just won't find its target there, same as a manually broken link.

import type { Layer } from "./types";

let clipboard: Layer | null = null;
let version = 0;
const listeners = new Set<() => void>();

export const subscribeLayerClipboard = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const getLayerClipboardVersion = () => version;
export const layerClipboard = () => clipboard;

export function copyLayer(layer: Layer): void {
  clipboard = structuredClone(layer);
  version++;
  for (const l of listeners) l();
}

const newId = () =>
  crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/** A ready-to-add clone of the clipboard — a fresh id, nothing else
 * changed — or undefined with nothing copied yet. `ADD_LAYER` handles the
 * rest (single-slot roles, joining an open condition, …). */
export function pasteLayer(): Layer | undefined {
  if (!clipboard) return undefined;
  return { ...structuredClone(clipboard), id: newId() };
}
