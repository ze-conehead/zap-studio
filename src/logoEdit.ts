// Magic-wand editing for a logo in "Manage logos": click a spot (a stray
// circle, a coloured square, a background patch) and either erase it to
// transparency or flood it with a solid colour, spreading to every
// connected pixel within a colour tolerance.

export type WandMode = "erase" | "fill";

// Euclidean distance across R/G/B/A, 0..~510 — the UI slider (0..100) maps
// onto this range.
const MAX_DISTANCE = Math.sqrt(255 * 255 * 4);
export const toleranceFromPercent = (pct: number) => (pct / 100) * MAX_DISTANCE;

/**
 * 4-connected flood fill, mutating `data` in place (a canvas ImageData's
 * `.data`, or any same-shaped RGBA buffer). `tolerance` is the max colour
 * distance (see toleranceFromPercent) from the starting pixel to still
 * count as "the same region". `mode: "erase"` zeroes alpha; `"fill"` paints
 * `color` (r, g, b, a 0..255) instead.
 */
export function floodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  tolerance: number,
  mode: WandMode,
  color: [number, number, number, number] = [0, 0, 0, 255],
): number {
  startX = Math.floor(startX);
  startY = Math.floor(startY);
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return 0;

  const startI = (startY * width + startX) * 4;
  const sr = data[startI];
  const sg = data[startI + 1];
  const sb = data[startI + 2];
  const sa = data[startI + 3];
  const matches = (i: number) => {
    const dr = data[i] - sr;
    const dg = data[i + 1] - sg;
    const db = data[i + 2] - sb;
    const da = data[i + 3] - sa;
    return Math.sqrt(dr * dr + dg * dg + db * db + da * da) <= tolerance;
  };

  const visited = new Uint8Array(width * height);
  const stack: number[] = [startX, startY];
  let painted = 0;

  while (stack.length) {
    const y = stack.pop()!;
    const x = stack.pop()!;
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const pos = y * width + x;
    if (visited[pos]) continue;
    const i = pos * 4;
    if (!matches(i)) continue;
    visited[pos] = 1;
    painted++;
    if (mode === "erase") {
      data[i + 3] = 0;
    } else {
      data[i] = color[0];
      data[i + 1] = color[1];
      data[i + 2] = color[2];
      data[i + 3] = color[3];
    }
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }
  return painted;
}

export function parseHexColor(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return [0, 0, 0];
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
