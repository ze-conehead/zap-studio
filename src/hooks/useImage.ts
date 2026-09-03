import { useEffect, useState } from "react";

// Minimal image loader/cache for Konva nodes.
const cache = new Map<string, HTMLImageElement>();

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
