// "Copy style" / "Paste style": the look of a layer — colours, font,
// stroke, shadow, opacity — without its position, size or content. One
// in-memory clipboard for the session. Pasting onto a different kind of
// layer carries over only what applies (opacity, shadow, and the fill /
// stroke where both sides have one).

import type { Layer } from "./types";

const TEXT_KEYS = [
  "fontFamily", "fontSize", "bold", "italic", "fill", "align", "lineHeight",
  "letterSpacing", "stroke", "strokeWidth", "autoFit", "autoFitLines",
] as const;
const SHAPE_KEYS = ["fill", "stroke", "strokeWidth", "cornerRadius"] as const;
const IMAGE_KEYS = ["cornerRadius", "adjust"] as const;
const QR_KEYS = ["fg", "bg", "bgEnabled", "ecLevel"] as const;
const COMMON_KEYS = ["opacity", "shadow"] as const;

export interface LayerStyle {
  type: Layer["type"];
  props: Record<string, unknown>;
}

let clipboard: LayerStyle | null = null;
let version = 0;
const listeners = new Set<() => void>();
export const subscribeStyleClipboard = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
export const getStyleClipboardVersion = () => version;
export const styleClipboard = () => clipboard;

function keysFor(type: Layer["type"]): readonly string[] {
  switch (type) {
    case "text": return [...COMMON_KEYS, ...TEXT_KEYS];
    case "shape": return [...COMMON_KEYS, ...SHAPE_KEYS];
    case "image": return [...COMMON_KEYS, ...IMAGE_KEYS];
    case "qr": return [...COMMON_KEYS, ...QR_KEYS];
    default: return [...COMMON_KEYS];
  }
}

export function copyStyle(layer: Layer): void {
  const src = layer as unknown as Record<string, unknown>;
  const props: Record<string, unknown> = {};
  for (const k of keysFor(layer.type)) if (src[k] !== undefined) props[k] = src[k];
  clipboard = { type: layer.type, props: structuredClone(props) };
  version++;
  for (const l of listeners) l();
}

/** The patch pasting the clipboard onto `target` would apply — {} if none. */
export function pasteStyle(target: Layer): Partial<Layer> {
  if (!clipboard) return {};
  const wanted = new Set(keysFor(target.type));
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(clipboard.props)) {
    if (!wanted.has(k)) continue;
    // A text fill is a colour string, a shape fill a CardBackground —
    // never mix the two across kinds.
    if (k === "fill" && clipboard.type !== target.type) continue;
    patch[k] = structuredClone(v);
  }
  return patch as Partial<Layer>;
}
