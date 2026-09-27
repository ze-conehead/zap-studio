import { describe, expect, it } from "vitest";
import { floodFill, parseHexColor, toleranceFromPercent } from "./logoEdit";

// A small RGBA buffer helper: draws a 2x2 red square in the corner of an
// otherwise white W x H image, mimicking a stray artifact on a logo.
function makeImage(w: number, h: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
    data[i + 3] = 255;
  }
  const dot = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    data[i] = 255;
    data[i + 1] = 0;
    data[i + 2] = 0;
    data[i + 3] = 255;
  };
  dot(0, 0);
  dot(1, 0);
  dot(0, 1);
  dot(1, 1);
  return data;
}

describe("floodFill", () => {
  it("erases only the connected red dot, leaving the white field alone", () => {
    const w = 6;
    const h = 6;
    const data = makeImage(w, h);
    const painted = floodFill(data, w, h, 0, 0, 10, "erase");
    expect(painted).toBe(4);
    // The 2x2 red square is now transparent.
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
      const i = (y * w + x) * 4;
      expect(data[i + 3]).toBe(0);
    }
    // A pixel outside the dot is untouched.
    const outside = (3 * w + 3) * 4;
    expect([data[outside], data[outside + 1], data[outside + 2], data[outside + 3]]).toEqual([
      255, 255, 255, 255,
    ]);
  });

  it("fills the connected region with the given colour instead of erasing", () => {
    const w = 6;
    const h = 6;
    const data = makeImage(w, h);
    floodFill(data, w, h, 0, 0, 10, "fill", [0, 255, 0, 255]);
    const i = 0;
    expect([data[i], data[i + 1], data[i + 2], data[i + 3]]).toEqual([0, 255, 0, 255]);
  });

  it("doesn't spread across a colour that's outside the tolerance", () => {
    const w = 6;
    const h = 6;
    const data = makeImage(w, h);
    // White field (255,255,255) vs. red dot (255,0,0): distance is large —
    // a near-zero tolerance keeps the fill inside the dot.
    const painted = floodFill(data, w, h, 0, 0, 1, "erase");
    expect(painted).toBe(4);
  });

  it("a generous tolerance spreads past a near (but not exact) colour match", () => {
    const w = 4;
    const h = 1;
    const data = new Uint8ClampedArray(w * h * 4);
    // Two near-identical light greys side by side.
    for (let x = 0; x < 2; x++) {
      const i = x * 4;
      data[i] = 200;
      data[i + 1] = 200;
      data[i + 2] = 200;
      data[i + 3] = 255;
    }
    for (let x = 2; x < 4; x++) {
      const i = x * 4;
      data[i] = 205;
      data[i + 1] = 205;
      data[i + 2] = 205;
      data[i + 3] = 255;
    }
    const painted = floodFill(data, w, h, 0, 0, 20, "erase");
    expect(painted).toBe(4); // tolerance 20 bridges the 5-unit gap
  });

  it("does nothing for a start point outside the image", () => {
    const w = 4;
    const h = 4;
    const data = makeImage(w, h);
    const before = data.slice();
    const painted = floodFill(data, w, h, -1, 0, 50, "erase");
    expect(painted).toBe(0);
    expect(data).toEqual(before);
  });
});

describe("toleranceFromPercent", () => {
  it("maps 0-100% onto the 0..max colour-distance range", () => {
    expect(toleranceFromPercent(0)).toBe(0);
    expect(toleranceFromPercent(100)).toBeCloseTo(Math.sqrt(255 * 255 * 4));
  });
});

describe("parseHexColor", () => {
  it("parses 3- and 6-digit hex, with or without #", () => {
    expect(parseHexColor("#ff0000")).toEqual([255, 0, 0]);
    expect(parseHexColor("00ff00")).toEqual([0, 255, 0]);
    expect(parseHexColor("#00f")).toEqual([0, 0, 255]);
  });

  it("falls back to black for anything unparseable", () => {
    expect(parseHexColor("not-a-color")).toEqual([0, 0, 0]);
  });
});
