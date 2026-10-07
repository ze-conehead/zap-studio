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

// The gradient's colour stops (>= 2). Legacy fills only had color / color2.
export function gradientStops(bg: CardBackground): string[] {
  if (bg.stops && bg.stops.length >= 2) return bg.stops;
  return [bg.color, bg.color2 ?? bg.color];
}

// Konva "colorStops" array: [pos, colour, pos, colour, …] evenly spaced.
function colorStopArray(stops: string[]): (number | string)[] {
  const n = stops.length;
  return stops.flatMap((c, i) => [n <= 1 ? 0 : i / (n - 1), c]);
}

// Konva fill props for a gradient (linear or radial) over a w×h box.
// originCentered: shape origin is its centre (Ellipse) rather than top-left.
export function gradientFill(
  bg: CardBackground,
  w: number,
  h: number,
  originCentered = false,
) {
  const stops = colorStopArray(gradientStops(bg));
  if ((bg.gradientKind ?? "linear") === "radial") {
    const cx = originCentered ? 0 : w / 2;
    const cy = originCentered ? 0 : h / 2;
    const center = { x: cx, y: cy };
    return {
      fillRadialGradientStartPoint: center,
      fillRadialGradientEndPoint: center,
      fillRadialGradientStartRadius: 0,
      fillRadialGradientEndRadius: Math.hypot(w, h) / 2,
      fillRadialGradientColorStops: stops,
    };
  }
  const { start, end } = gradientPointsBox(w, h, bg.angle, originCentered);
  return {
    fillLinearGradientStartPoint: start,
    fillLinearGradientEndPoint: end,
    fillLinearGradientColorStops: stops,
  };
}

/**
 * One grain pixel from a random 0..1: black or white, with an opacity that
 * grows with the distance from the middle. Laid over a colour with the plain
 * "source-over" blend this darkens and lightens it in equal measure, so it
 * shows on any colour — the "overlay" blend the grain used before multiplies
 * with what's underneath, so it left a dark or light fill almost untouched.
 */
export function grainPixel(v: number): { value: 0 | 255; alpha: number } {
  const s = (v - 0.5) * 2; // -1 … 1
  return { value: s > 0 ? 255 : 0, alpha: Math.round(Math.abs(s) * 255) };
}

// Grain tile, generated once and reused for preview + export. Used with the
// normal blend at the fill's grain strength as opacity (see grainPixel).
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
    const { value, alpha } = grainPixel(Math.random());
    img.data[i] = value;
    img.data[i + 1] = value;
    img.data[i + 2] = value;
    img.data[i + 3] = alpha;
  }
  ctx.putImageData(img, 0, 0);
  tile = c;
  return c;
}
