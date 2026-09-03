import { CANVAS } from "./card";
import type { CardBackground, Project } from "./types";

export const DEFAULT_BACKGROUND: CardBackground = {
  kind: "solid",
  color: "#1e293b",
  color2: "#0f172a",
  angle: 90,
  noise: 0,
};

// Normalise a project's background, upgrading legacy `backgroundColor`-only data.
export function resolveBackground(p: Pick<Project, "background" | "backgroundColor">): CardBackground {
  if (p.background) return { ...DEFAULT_BACKGROUND, ...p.background };
  return { ...DEFAULT_BACKGROUND, color: p.backgroundColor || DEFAULT_BACKGROUND.color };
}

// Gradient start/end points that fully cover the card for a given angle.
export function gradientPoints(angle: number) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const cx = CANVAS.w / 2;
  const cy = CANVAS.h / 2;
  const ext = Math.abs(dx) * (CANVAS.w / 2) + Math.abs(dy) * (CANVAS.h / 2);
  return {
    start: { x: cx - dx * ext, y: cy - dy * ext },
    end: { x: cx + dx * ext, y: cy + dy * ext },
  };
}

// Monochrome grain tile, generated once and reused for preview + export.
let tile: HTMLCanvasElement | null = null;
export function noiseTile(): HTMLCanvasElement {
  if (tile) return tile;
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  tile = c;
  return c;
}
