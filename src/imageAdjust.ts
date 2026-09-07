// Per-layer image adjustment: strip the colour out of a picture or a logo and
// push it to pure black and white with an adjustable threshold, optionally as
// a one-colour silhouette on transparency.
//
// Konva's own filters need node.cache(), which fights the globalCompositeOperation
// masking the editor uses, so the pixels are processed into an offscreen canvas
// instead and that canvas is handed to <KImage image={...}>.

import { useEffect, useState } from "react";

export type AdjustMode = "none" | "grayscale" | "threshold";

export interface ImageAdjust {
  mode: AdjustMode;
  /** threshold mode: luminance cut-off, 0-255. */
  threshold: number;
  /** Swap light and dark. */
  invert: boolean;
  /** threshold mode: paint the kept side in `color`, drop the rest to alpha 0. */
  silhouette: boolean;
  color: string; // "#ffffff" / "#000000" / anything CSS
  /** -100…100, applied before the mode. */
  contrast: number;
  brightness: number;
}

export const DEFAULT_ADJUST: ImageAdjust = {
  mode: "none",
  threshold: 128,
  invert: false,
  silhouette: false,
  color: "#ffffff",
  contrast: 0,
  brightness: 0,
};

export const isAdjusted = (a?: ImageAdjust): boolean =>
  !!a && (a.mode !== "none" || a.contrast !== 0 || a.brightness !== 0);

function parseColor(css: string): [number, number, number] {
  const hex = css.trim();
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex);
  if (m) {
    const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  // Anything else (oklch, rgb, a colour name) — let the browser resolve it.
  try {
    const c = document.createElement("canvas").getContext("2d")!;
    c.fillStyle = "#000";
    c.fillStyle = css;
    c.fillRect(0, 0, 1, 1);
    const d = c.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  } catch {
    return [255, 255, 255];
  }
}

/**
 * Runs `img` through the adjustment and returns a canvas ready for Konva.
 * Returns the image itself when nothing would change.
 */
export function adjustImage(
  img: HTMLImageElement,
  adj: ImageAdjust,
): HTMLCanvasElement | HTMLImageElement {
  if (!isAdjusted(adj)) return img;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return img;

  const cvs = document.createElement("canvas");
  cvs.width = w;
  cvs.height = h;
  const ctx = cvs.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, w, h);

  let data: ImageData;
  try {
    data = ctx.getImageData(0, 0, w, h);
  } catch {
    return img; // tainted canvas (cross-origin image without CORS)
  }
  const px = data.data;

  // Brightness/contrast as the usual -100…100 photo-editor sliders.
  const b = (adj.brightness / 100) * 255;
  const cRaw = adj.contrast / 100;
  const cF = (259 * (cRaw * 255 + 255)) / (255 * (259 - cRaw * 255));
  const [sr, sg, sb] = adj.silhouette ? parseColor(adj.color) : [0, 0, 0];

  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue; // fully transparent — nothing to do

    const r = cF * (px[i] - 128) + 128 + b;
    const g = cF * (px[i + 1] - 128) + 128 + b;
    const bl = cF * (px[i + 2] - 128) + 128 + b;

    if (adj.mode === "none") {
      px[i] = clamp(r);
      px[i + 1] = clamp(g);
      px[i + 2] = clamp(bl);
      continue;
    }

    // Rec. 709 luma — matches how the eye weights the channels.
    let lum = 0.2126 * r + 0.7152 * g + 0.0722 * bl;

    if (adj.mode === "grayscale") {
      if (adj.invert) lum = 255 - lum;
      const v = clamp(lum);
      px[i] = v;
      px[i + 1] = v;
      px[i + 2] = v;
      continue;
    }

    // threshold
    let on = lum >= adj.threshold;
    if (adj.invert) on = !on;
    if (adj.silhouette) {
      if (on) {
        px[i] = sr;
        px[i + 1] = sg;
        px[i + 2] = sb;
      } else {
        px[i + 3] = 0;
      }
    } else {
      const v = on ? 255 : 0;
      px[i] = v;
      px[i + 1] = v;
      px[i + 2] = v;
    }
  }

  ctx.putImageData(data, 0, 0);
  return cvs;
}

const clamp = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);

/**
 * The adjusted version of `img`. Recomputed only when the image or the
 * settings actually change; without an adjustment the original is passed
 * straight through.
 */
export function useAdjustedImage(
  img: HTMLImageElement | undefined,
  adj?: ImageAdjust,
): HTMLImageElement | HTMLCanvasElement | undefined {
  const key = img && isAdjusted(adj) ? JSON.stringify(adj) : "";
  const [out, setOut] = useState<HTMLImageElement | HTMLCanvasElement | undefined>(img);

  useEffect(() => {
    if (!img) {
      setOut(undefined);
      return;
    }
    setOut(key ? adjustImage(img, adj as ImageAdjust) : img);
    // `key` already encodes every field of `adj`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, key]);

  return out;
}
