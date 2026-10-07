import { describe, expect, it } from "vitest";
import { clampPan, panLimit, PAN_KEEP } from "./panLimit";

describe("panLimit", () => {
  it("lets a big object go far past its edge, a small one less far", () => {
    // a 3000 px object in a 1000 px view: its edge can travel well past centre
    expect(panLimit(1000, 3000)).toBe(500 + 1500 - PAN_KEEP);
    // a 100 px object: it can leave the centre until it touches the border
    expect(panLimit(1000, 100)).toBe(500 + 50 - 100);
  });

  it("always leaves a grabbable piece on screen", () => {
    for (const size of [60, 400, 5000]) {
      const l = panLimit(1000, size);
      // at the limit the object spans [l - size/2, l + size/2] around the view's centre
      const visible = 500 - (l - size / 2);
      expect(visible).toBeGreaterThanOrEqual(Math.min(size, PAN_KEEP) - 0.001);
    }
  });

  it("clamps both ways and never goes negative", () => {
    expect(clampPan(99999, 1000, 400)).toBe(panLimit(1000, 400));
    expect(clampPan(-99999, 1000, 400)).toBe(-panLimit(1000, 400));
    expect(clampPan(10, 1000, 400)).toBe(10);
    expect(panLimit(0, 0)).toBe(0);
  });
});
