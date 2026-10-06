// The contrast colour: black or white, whichever reads better on whatever
// sits underneath. A colour field set to CONTRAST_TOKEN (typically a text
// fill in a template) gets it per card, worked out right before rendering
// from the topmost picture or filled shape below the layer — sampling the
// picture under the layer's own box — or else the card background.

import { croppedNatural } from "./factory";
import { cachedImage } from "./hooks/useImage";
import { bounds, type Box } from "./layerBounds";
import { replaceToken } from "./accent";
import type { CardBackground, ImageLayer, Layer } from "./types";

export const CONTRAST_TOKEN = "{contrast}";
export const CONTRAST_DARK = "#111111";
export const CONTRAST_LIGHT = "#ffffff";
// Relative luminance above which dark text reads better.
const THRESHOLD = 0.55;

export const isContrast = (v: unknown) => v === CONTRAST_TOKEN;

const hasToken = (v: unknown): boolean => {
  if (v === CONTRAST_TOKEN) return true;
  if (Array.isArray(v)) return v.some(hasToken);
  if (v && typeof v === "object") {
    return Object.entries(v).some(([k, x]) => k !== "src" && hasToken(x));
  }
  return false;
};

function hexLuminance(hex: string): number | undefined {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return undefined;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  const n = parseInt(h, 16);
  return rgbLuminance((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

const rgbLuminance = (r: number, g: number, b: number) =>
  (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;

function fillLuminance(f: CardBackground | undefined | null): number | undefined {
  if (!f || f.kind === "none") return undefined;
  const colors = f.kind === "gradient" ? (f.stops?.length ? f.stops : [f.color, f.color2]) : [f.color];
  const ls = colors.map(hexLuminance).filter((x): x is number => x !== undefined);
  return ls.length ? ls.reduce((a, b) => a + b, 0) / ls.length : undefined;
}

// A small, readable copy of each picture, made once per src.
const SAMPLE = 64;
const pixels = new Map<string, Uint8ClampedArray | null>();
function pixelsOf(src: string): Uint8ClampedArray | null | undefined {
  if (pixels.has(src)) return pixels.get(src);
  const img = cachedImage(src);
  if (!img) return undefined; // not decoded yet
  let data: Uint8ClampedArray | null = null;
  try {
    const c = document.createElement("canvas");
    c.width = SAMPLE;
    c.height = SAMPLE;
    const ctx = c.getContext("2d", { willReadFrequently: true });
    if (ctx) {
      ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
      data = ctx.getImageData(0, 0, SAMPLE, SAMPLE).data;
    }
  } catch {
    data = null; // tainted
  }
  pixels.set(src, data);
  return data;
}

/** Mean luminance of the part of `img` under `box`, or undefined if none of it is. */
function imageLuminanceUnder(img: ImageLayer, box: Box): number | undefined {
  const data = pixelsOf(img.src);
  if (!data) return undefined;
  const w = img.width * img.scaleX;
  const h = img.height * img.scaleY;
  if (!w || !h) return undefined;
  const r = (-img.rotation * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  const c = img.crop ?? { l: 0, t: 0, r: 0, b: 0 };
  const nat = croppedNatural(img);
  const fw = nat.w / img.naturalWidth;
  const fh = nat.h / img.naturalHeight;
  let sum = 0;
  let n = 0;
  const STEPS = 6;
  for (let i = 0; i < STEPS; i++) {
    for (let j = 0; j < STEPS; j++) {
      const px = box.x1 + ((i + 0.5) / STEPS) * (box.x2 - box.x1);
      const py = box.y1 + ((j + 0.5) / STEPS) * (box.y2 - box.y1);
      const dx = px - img.x;
      const dy = py - img.y;
      const u = (dx * cos - dy * sin) / w + 0.5;
      const v = (dx * sin + dy * cos) / h + 0.5;
      if (u < 0 || u > 1 || v < 0 || v > 1) continue;
      const sx = Math.min(SAMPLE - 1, Math.floor((c.l + u * fw) * SAMPLE));
      const sy = Math.min(SAMPLE - 1, Math.floor((c.t + v * fh) * SAMPLE));
      const k = (sy * SAMPLE + sx) * 4;
      if (data[k + 3] < 64) continue; // transparent there — look further down
      sum += rgbLuminance(data[k], data[k + 1], data[k + 2]);
      n++;
    }
  }
  return n ? sum / n : undefined;
}

function contains(l: Layer, x: number, y: number): boolean {
  const b = bounds(l);
  return !!b && x >= b.x1 && x <= b.x2 && y >= b.y1 && y <= b.y2;
}

// Layers that don't paint anything a reader would see behind text.
const transparent = (l: Layer) =>
  !l.visible ||
  l.mask ||
  !!l.alphaMask ||
  !!l.logoSlot ||
  l.type === "text" ||
  l.type === "qr" ||
  l.type === "condition" ||
  l.type === "metabadge" ||
  l.type === "background";

/** What's under layer `i` of `layers`: its luminance, or undefined to fall through to the background. */
function luminanceUnder(layers: Layer[], i: number, box: Box): number | undefined {
  const cx = (box.x1 + box.x2) / 2;
  const cy = (box.y1 + box.y2) / 2;
  for (let j = i - 1; j >= 0; j--) {
    const l = layers[j];
    if (transparent(l) || !contains(l, cx, cy)) continue;
    const lum =
      l.type === "image"
        ? imageLuminanceUnder(l, box)
        : l.type === "shape"
          ? fillLuminance(l.fill)
          : undefined;
    if (lum !== undefined) return lum;
  }
  return undefined;
}

/**
 * Resolves CONTRAST_TOKEN in every layer that uses it, from what lies below
 * it in `layers` (bottom first) and, failing that, the card background.
 * Untouched layers keep their identity.
 */
export function applyContrast(layers: Layer[], bg: CardBackground | null | undefined): Layer[] {
  if (!layers.some(hasToken)) return layers;
  const bgLum = fillLuminance(bg);
  return layers.map((l, i) => {
    if (!hasToken(l)) return l;
    const box = bounds(l);
    const lum = (box && luminanceUnder(layers, i, box)) ?? bgLum ?? 0;
    return replaceToken(l, CONTRAST_TOKEN, lum > THRESHOLD ? CONTRAST_DARK : CONTRAST_LIGHT);
  });
}
