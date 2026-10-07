import { describe, expect, it } from "vitest";
import { grainPixel } from "./background";

describe("grainPixel", () => {
  it("is black below the middle, white above, and fades out towards the middle", () => {
    expect(grainPixel(0)).toEqual({ value: 0, alpha: 255 });
    expect(grainPixel(1)).toEqual({ value: 255, alpha: 255 });
    expect(grainPixel(0.5).alpha).toBe(0);
    expect(grainPixel(0.25)).toEqual({ value: 0, alpha: 128 });
    expect(grainPixel(0.75)).toEqual({ value: 255, alpha: 128 });
  });

  it("darkens and lightens evenly, so the average colour stays put", () => {
    // sample the whole range: average signed push (white = +, black = −) ≈ 0
    let push = 0;
    const n = 1000;
    for (let i = 0; i < n; i++) {
      const { value, alpha } = grainPixel((i + 0.5) / n);
      push += (value === 255 ? 1 : -1) * alpha;
    }
    expect(Math.abs(push / n)).toBeLessThan(1);
  });
});
