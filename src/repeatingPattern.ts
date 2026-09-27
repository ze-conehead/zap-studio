// A logo tiled across a shape or background fill: rotated in place and
// repeated on a grid, with alternating rows optionally offset ("stagger")
// for a brick-laid look instead of a plain grid. The logo comes from the
// user's own "Manage logos" library (src/localLogos.ts).

import { useEffect, useMemo, useState } from "react";
import { useImage } from "./hooks/useImage";
import { localLogoUrl } from "./localLogos";

export interface RepeatingImagePattern {
  enabled: boolean;
  logoId?: string; // id into the Managed Logos library
  size: number; // px — the tile logo's rendered width; height follows its own aspect ratio
  spacing: number; // px gap between repeats
  rotation: number; // degrees, applied to each repeated instance in place
  opacity: number; // 0..1
  stagger: number; // 0..100 (%) — horizontal offset of every other row; 0 = plain grid, 50 = brick pattern
}

export const DEFAULT_PATTERN: RepeatingImagePattern = {
  enabled: false,
  logoId: undefined,
  size: 60,
  spacing: 20,
  rotation: 45,
  opacity: 0.25,
  stagger: 50,
};

/** Draws `img` into a seamlessly tileable canvas per `p` — pass as Konva's
 * `fillPatternImage` with `fillPatternRepeat: "repeat"`. */
export function buildPatternTile(img: HTMLImageElement, p: RepeatingImagePattern): HTMLCanvasElement {
  const naturalW = img.naturalWidth || img.width || 1;
  const naturalH = img.naturalHeight || img.height || 1;
  const drawW = Math.max(1, p.size);
  const drawH = Math.max(1, drawW * (naturalH / naturalW));
  const cellW = Math.max(1, drawW + p.spacing);
  const cellH = Math.max(1, drawH + p.spacing);
  const shiftX = (p.stagger / 100) * cellW;

  const cvs = document.createElement("canvas");
  cvs.width = Math.round(cellW);
  cvs.height = Math.round(cellH * 2);
  const ctx = cvs.getContext("2d")!;

  const draw = (cx: number, cy: number) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((p.rotation * Math.PI) / 180);
    ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();
  };
  // Each row is drawn three times across (its own cell, plus one cell to
  // each side) so a rotated / shifted instance that spills past this
  // tile's edge still shows up seamlessly once Konva repeats it.
  for (const dx of [-cellW, 0, cellW]) draw(cellW / 2 + dx, cellH / 2);
  for (const dx of [-cellW, 0, cellW]) draw(cellW / 2 + shiftX + dx, cellH * 1.5);

  return cvs;
}

function useLogoImage(logoId: string | undefined): HTMLImageElement | undefined {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    if (!logoId) {
      setUrl(undefined);
      return;
    }
    void localLogoUrl(logoId).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [logoId]);
  return useImage(url);
}

/** The pattern's ready-to-use Konva fillPatternImage, or undefined while
 * disabled, loading, or no logo picked yet. */
export function usePatternTile(pattern: RepeatingImagePattern | undefined): HTMLCanvasElement | undefined {
  const enabled = !!pattern?.enabled && !!pattern.logoId;
  const img = useLogoImage(enabled ? pattern!.logoId : undefined);
  return useMemo(() => {
    if (!enabled || !img) return undefined;
    return buildPatternTile(img, pattern!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, enabled, pattern?.size, pattern?.spacing, pattern?.rotation, pattern?.stagger]);
}
