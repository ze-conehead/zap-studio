import { CANVAS } from "./card";
import type { CardBackground, Project } from "./types";

export const DEFAULT_BACKGROUND: CardBackground = {
  kind: "solid",
  color: "#1e293b",
  color2: "#0f172a",
  angle: 90,
  noise: 0,
  enabled: true,
};

export const DEFAULT_SHAPE_FILL: CardBackground = {
  kind: "solid",
  color: "#38bdf8",
  color2: "#6366f1",
  angle: 90,
  noise: 0,
};

// Normalise a project's background, upgrading legacy `backgroundColor`-only data.
export function resolveBackground(p: Pick<Project, "background" | "backgroundColor">): CardBackground {
  if (p.background) return { ...DEFAULT_BACKGROUND, ...p.background };
  return {
    ...DEFAULT_BACKGROUND,
    color: p.backgroundColor && p.backgroundColor !== "transparent"
      ? p.backgroundColor
      : DEFAULT_BACKGROUND.color,
    enabled: p.backgroundColor !== "transparent",
  };
}

// Gradient start/end points that fully cover a w×h box for a given angle.
// originCentered: true when the shape's local origin is its centre (Ellipse),
// false when it is the top-left corner (Rect, card background).
export function gradientPointsBox(
  w: number,
  h: number,
  angle: number,
  originCentered = false,
) {
  const rad = (angle * Math.PI) / 180;
  const dx = Math.cos(rad);
  const dy = Math.sin(rad);
  const cx = originCentered ? 0 : w / 2;
  const cy = originCentered ? 0 : h / 2;
  const ext = Math.abs(dx) * (w / 2) + Math.abs(dy) * (h / 2);
  return {
    start: { x: cx - dx * ext, y: cy - dy * ext },
    end: { x: cx + dx * ext, y: cy + dy * ext },
  };
}

export const gradientPoints = (angle: number) =>
  gradientPointsBox(CANVAS.w, CANVAS.h, angle);

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
