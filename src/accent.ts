// The card's accent colour: the dominant colour of its cover (or its first
// framed picture), so every card can pick up its own game's tint. A colour
// field set to ACCENT_TOKEN — in a template, typically — paints that colour;
// the token is swapped for the real value right before rendering
// (applyAccent), in the editor and in every export alike.

import { cachedImage, useImage } from "./hooks/useImage";
import { mainMaskOf, resolveMask } from "./templates";
import type { ImageLayer, Layer, Project } from "./types";

export const ACCENT_TOKEN = "{accent}";
export const DEFAULT_ACCENT = "#64748b";

export const isAccent = (v: unknown) => v === ACCENT_TOKEN;

/**
 * The picture the accent comes from: the image in the cover frame, else the
 * one in the first filled frame (in the templates' frame order), else the
 * biggest image. Logos and spine backgrounds don't count — they don't say
 * much about the game.
 */
export function accentSource(project: Project, masks: Layer[] = []): ImageLayer | undefined {
  const imgs = project.layers.filter(
    (l): l is ImageLayer => l.type === "image" && l.visible && !l.logo && !l.spineBg && !!l.src,
  );
  if (!imgs.length) return undefined;
  const cover = mainMaskOf(masks);
  const order = cover ? [cover, ...masks.filter((m) => m.id !== cover.id)] : masks;
  for (const m of order) {
    const hit = imgs.find((l) => resolveMask(l, masks)?.id === m.id);
    if (hit) return hit;
  }
  return [...imgs].sort((a, b) => b.width * b.height - a.width * a.height)[0];
}

const memo = new Map<string, string>();

const hex = (r: number, g: number, b: number) =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/**
 * The dominant colour of an image: pixels are bucketed by hue/brightness
 * and each bucket is weighted by saturation, so a big grey sky loses to the
 * red logo on it, and near-black/near-white only win when there's nothing
 * else. Returns the average colour of the winning bucket.
 */
export function dominantColor(img: HTMLImageElement | HTMLCanvasElement): string {
  const N = 48;
  const c = document.createElement("canvas");
  c.width = N;
  c.height = N;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  if (!ctx) return DEFAULT_ACCENT;
  ctx.drawImage(img, 0, 0, N, N);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, N, N).data;
  } catch {
    return DEFAULT_ACCENT; // tainted (cross-origin) image
  }
  const buckets = new Map<number, { w: number; r: number; g: number; b: number; n: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 510;
    const s = max === min ? 0 : (max - min) / (255 - Math.abs(max + min - 255));
    let h = 0;
    if (max !== min) {
      const d = max - min;
      h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
      h = (h * 60 + 360) % 360;
    }
    const key = s < 0.15 ? 1000 + Math.round(l * 4) : Math.round(h / 24) * 10 + Math.round(l * 4);
    // Saturated, mid-brightness pixels count most.
    const w = 0.08 + s * (1 - Math.abs(l - 0.5) * 1.6);
    const e = buckets.get(key) ?? { w: 0, r: 0, g: 0, b: 0, n: 0 };
    e.w += w;
    e.r += r;
    e.g += g;
    e.b += b;
    e.n++;
    buckets.set(key, e);
  }
  let best: { w: number; r: number; g: number; b: number; n: number } | undefined;
  for (const e of buckets.values()) if (!best || e.w > best.w) best = e;
  return best ? hex(best.r / best.n, best.g / best.n, best.b / best.n) : DEFAULT_ACCENT;
}

/** The accent of an already-loaded image, cached per src. */
export function accentOfSrc(src: string): string | undefined {
  const hit = memo.get(src);
  if (hit) return hit;
  const img = cachedImage(src);
  if (!img) return undefined;
  const c = dominantColor(img);
  memo.set(src, c);
  return c;
}

/**
 * A card's accent: its own fixed one, else its cover's dominant colour
 * (when that image is loaded — exports preload it), else the default.
 */
export function cardAccent(project: Project, masks: Layer[] = []): string {
  if (project.accent) return project.accent;
  const src = accentSource(project, masks)?.src;
  return (src && accentOfSrc(src)) || DEFAULT_ACCENT;
}

/** cardAccent(), re-evaluated once the source picture has loaded. */
export function useCardAccent(project: Project, masks: Layer[] = []): string {
  const src = project.accent ? undefined : accentSource(project, masks)?.src;
  useImage(src); // re-renders when it arrives
  return cardAccent(project, masks);
}

/**
 * `value` with every `token` string swapped for `color`. Returns the very
 * same object when there's nothing to swap, so untouched layers keep their
 * identity.
 */
export function replaceToken<T>(value: T, token: string, color: string): T {
  if (value === token) return color as T;
  if (Array.isArray(value)) {
    let changed = false;
    const out = value.map((v) => {
      const n = replaceToken(v, token, color);
      if (n !== v) changed = true;
      return n;
    });
    return (changed ? out : value) as T;
  }
  if (value && typeof value === "object") {
    let out: Record<string, unknown> | null = null;
    for (const [k, v] of Object.entries(value)) {
      if (k === "src") continue; // image data — never a colour
      const n = replaceToken(v, token, color);
      if (n !== v) (out ??= { ...(value as Record<string, unknown>) })[k] = n;
    }
    return (out ?? value) as T;
  }
  return value;
}

/** `value` with every ACCENT_TOKEN swapped for `accent` (see replaceToken). */
export const applyAccent = <T,>(value: T, accent: string): T =>
  replaceToken(value, ACCENT_TOKEN, accent);
