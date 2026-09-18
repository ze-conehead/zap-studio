import { useEffect, useState } from "react";

// Minimal image loader/cache for Konva nodes.
const cache = new Map<string, HTMLImageElement>();

// Warms the same cache so a Stage mounted afterwards paints its images on
// the very first frame (needed before capturing one off-screen).
const PRELOAD_TIMEOUT_MS = 8000;

export function preloadImage(src: string): Promise<void> {
  if (!src || cache.has(src)) return Promise.resolve();
  return new Promise((resolve) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    // In the packaged app a request can end up stuck with neither `load`
    // nor `error` ever firing — without a timeout that wedges every batch
    // waiting on this image (e.g. a whole "Preview all" pass) forever.
    const timer = setTimeout(() => {
      console.error("preloadImage: timed out", src);
      resolve();
    }, PRELOAD_TIMEOUT_MS);
    el.onload = () => {
      clearTimeout(timer);
      cache.set(src, el);
      resolve();
    };
    el.onerror = () => {
      clearTimeout(timer);
      resolve();
    };
    el.src = src;
  });
}

export function useImage(src: string | undefined): HTMLImageElement | undefined {
  const [img, setImg] = useState<HTMLImageElement | undefined>(() =>
    src ? cache.get(src) : undefined,
  );

  useEffect(() => {
    if (!src) {
      setImg(undefined);
      return;
    }
    const hit = cache.get(src);
    if (hit) {
      setImg(hit);
      return;
    }
    let alive = true;
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => {
      cache.set(src, el);
      if (alive) setImg(el);
    };
    el.src = src;
    return () => {
      alive = false;
    };
  }, [src]);

  return img;
}
