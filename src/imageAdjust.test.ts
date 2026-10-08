import { describe, expect, it } from "vitest";
import { adjustPixels, DEFAULT_ADJUST, isAdjusted, type ImageAdjust } from "./imageAdjust";

const run = (rgba: number[], over: Partial<ImageAdjust>) => {
  const px = new Uint8ClampedArray(rgba);
  adjustPixels(px, { ...DEFAULT_ADJUST, ...over });
  return [...px];
};

describe("tint", () => {
  it("counts as an adjustment", () => {
    expect(isAdjusted({ ...DEFAULT_ADJUST, mode: "tint" })).toBe(true);
  });

  it("solid paints every pixel in the colour and keeps the alpha — a black logo turns red", () => {
    const out = run([0, 0, 0, 255, 0, 0, 0, 128, 0, 0, 0, 0], { mode: "tint", tint: "#ff0000", tintSolid: true });
    expect(out.slice(0, 4)).toEqual([255, 0, 0, 255]);
    expect(out.slice(4, 8)).toEqual([255, 0, 0, 128]);
    expect(out.slice(8, 12)).toEqual([0, 0, 0, 0]); // fully transparent: untouched
  });

  it("solid also recolours a white logo", () => {
    expect(run([255, 255, 255, 255], { mode: "tint", tint: "#00ff00", tintSolid: true })).toEqual([0, 255, 0, 255]);
  });

  it("shaded: shadows stay black, highlights white, the middle takes the colour", () => {
    const tint = { mode: "tint" as const, tint: "#ff0000" };
    expect(run([0, 0, 0, 255], tint)).toEqual([0, 0, 0, 255]);
    expect(run([255, 255, 255, 255], tint)).toEqual([255, 255, 255, 255]);
    const mid = run([128, 128, 128, 255], tint);
    expect(mid[0]).toBeGreaterThan(240);
    expect(mid[1]).toBeLessThan(10);
    expect(mid[2]).toBeLessThan(10);
  });

  it("strength 0 leaves the picture as it was, 50 sits halfway", () => {
    expect(run([40, 90, 200, 255], { mode: "tint", tint: "#ff0000", tintSolid: true, tintAmount: 0 })).toEqual([40, 90, 200, 255]);
    const half = run([0, 0, 0, 255], { mode: "tint", tint: "#ff0000", tintSolid: true, tintAmount: 50 });
    expect(half[0]).toBeCloseTo(127, -1);
    expect(half[1]).toBe(0);
  });
});
