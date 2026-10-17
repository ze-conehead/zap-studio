import { describe, expect, it } from "vitest";
import { CANVAS, TRIM_RECT } from "./card";
import { canFit, fitPatch } from "./fitLayer";
import { makeImageLayer, makeShapeLayer, makeTextLayer } from "./factory";

const img = (w: number, h: number) => ({
  ...makeImageLayer({ src: "x", naturalWidth: w, naturalHeight: h, name: "i" }),
  width: w,
  height: h,
  rotation: 30,
});

describe("fitPatch", () => {
  it("width: as wide as the card, proportions kept, centred sideways, y untouched", () => {
    const p = fitPatch(img(200, 100), "width");
    expect(p.width).toBeCloseTo(TRIM_RECT.w);
    expect(p.height).toBeCloseTo(TRIM_RECT.w / 2);
    expect(p.x).toBeCloseTo(TRIM_RECT.x + TRIM_RECT.w / 2);
    expect(p).not.toHaveProperty("y");
    expect(p.rotation).toBe(0);
  });

  it("a picture covers the card: the smaller side reaches the edge, the other overhangs", () => {
    const wide = fitPatch(img(400, 100), "trim"); // very wide → height decides
    expect(wide.height).toBeCloseTo(TRIM_RECT.h);
    expect(wide.width).toBeCloseTo(TRIM_RECT.h * 4);
    const tall = fitPatch(img(100, 400), "trim"); // very tall → width decides
    expect(tall.width).toBeCloseTo(TRIM_RECT.w);
    expect(tall.height).toBeCloseTo(TRIM_RECT.w * 4);
    expect([wide.x, wide.y]).toEqual([TRIM_RECT.x + TRIM_RECT.w / 2, TRIM_RECT.y + TRIM_RECT.h / 2]);
  });

  it("bleed uses the whole artboard", () => {
    const p = fitPatch({ ...makeShapeLayer("rect"), width: 50, height: 50 }, "bleed");
    expect(p).toMatchObject({ width: CANVAS.w, height: CANVAS.h, x: CANVAS.w / 2, y: CANVAS.h / 2 });
  });

  it("a shape or QR code takes the exact size, a shape's scale accounted for", () => {
    const s = { ...makeShapeLayer("rect"), width: 100, height: 100, scaleX: 2, scaleY: 0.5 };
    const p = fitPatch(s, "trim");
    expect((p.width as number) * 2).toBeCloseTo(TRIM_RECT.w);
    expect((p.height as number) * 0.5).toBeCloseTo(TRIM_RECT.h);
  });

  it("only pictures, shapes and QR codes can be fitted", () => {
    expect(canFit(makeShapeLayer("circle"))).toBe(true);
    expect(canFit(img(10, 10))).toBe(true);
    expect(canFit(makeTextLayer())).toBe(false);
  });
});
