import { describe, expect, it } from "vitest";
import { makeImageLayer } from "./factory";
import { resolveSpineLayer, spineCountOf, spinePan, spinePlacement, spineZoomAt } from "./spine";
import type { ImageLayer } from "./types";

const rect = { x: 400, y: 0, w: 100, h: 500 };
const layer = (over: Partial<ImageLayer> = {}): ImageLayer => ({
  ...makeImageLayer({ src: "x", naturalWidth: 3000, naturalHeight: 1000, name: "s" }),
  spineBg: true,
  ...over,
});

describe("resolveSpineLayer", () => {
  it("sits exactly on the spine panel and is locked", () => {
    const r = resolveSpineLayer(layer(), { index: 0, count: 3 }, rect);
    expect(r).toMatchObject({ x: 450, y: 250, width: 100, height: 500, rotation: 0, locked: true });
  });

  it("cuts a wide picture into equal, gap-free slices", () => {
    // 3 spines → a 300×500 strip over a 3000×1000 picture: height-limited,
    // so only 20 % of the width survives, split in three.
    const crops = [0, 1, 2].map(
      (index) => resolveSpineLayer(layer(), { index, count: 3 }, rect).crop!,
    );
    expect(crops[0].t).toBeCloseTo(0);
    expect(crops[0].b).toBeCloseTo(0);
    const visible = (c: (typeof crops)[0]) => 1 - c.l - c.r;
    expect(visible(crops[0])).toBeCloseTo(0.2 / 3);
    // neighbouring slices touch: one's right edge is the next one's left edge
    expect(1 - crops[0].r).toBeCloseTo(crops[1].l);
    expect(1 - crops[1].r).toBeCloseTo(crops[2].l);
    // …and together they cover the centred 20 % exactly
    expect(crops[0].l).toBeCloseTo(0.4);
    expect(1 - crops[2].r).toBeCloseTo(0.6);
  });

  it("crops the height of a tall picture instead", () => {
    const tall = layer({ naturalWidth: 300, naturalHeight: 3000 });
    const c = resolveSpineLayer(tall, { index: 0, count: 3 }, rect).crop!;
    expect(c.l).toBeCloseTo(0);
    expect(1 - c.r).toBeCloseTo(1 / 3);
    expect(1 - c.t - c.b).toBeCloseTo(500 / 3000);
  });

  it("focus moves the kept part", () => {
    const left = resolveSpineLayer(layer({ spineFocus: { x: 0, y: 0.5 } }), { index: 0, count: 3 }, rect).crop!;
    const right = resolveSpineLayer(layer({ spineFocus: { x: 1, y: 0.5 } }), { index: 0, count: 3 }, rect).crop!;
    expect(left.l).toBeCloseTo(0);
    expect(right.l).toBeCloseTo(0.8);
  });

  it("an explicit spine count wins over the game count, and the index wraps", () => {
    expect(spineCountOf(layer({ spineCount: 5 }), { index: 0, count: 3 })).toBe(5);
    expect(spineCountOf(layer(), { index: 0, count: 0 })).toBe(1);
    const a = resolveSpineLayer(layer(), { index: 4, count: 3 }, rect).crop!;
    const b = resolveSpineLayer(layer(), { index: 1, count: 3 }, rect).crop!;
    expect(a).toEqual(b);
  });
});

describe("spine zoom and drag", () => {
  const count = 3;
  const strip = { w: 300, h: 500 };
  const near = (a: number, b: number) => expect(a).toBeCloseTo(b, 6);

  it("zoom 1 is the plain cover placement", () => {
    const p = spinePlacement(layer(), count, rect);
    near(p.h, 500); // height-limited: 3000×1000 → 1500×500
    near(p.w, 1500);
    near(p.left, -600); // centred: (1500-300)/2
    near(p.top, 0);
  });

  it("zooming in shrinks the kept part of every slice", () => {
    const plain = resolveSpineLayer(layer(), { index: 0, count }, rect).crop!;
    const zoomed = resolveSpineLayer(layer({ spineZoom: 2 }), { index: 0, count }, rect).crop!;
    near(1 - zoomed.l - zoomed.r, (1 - plain.l - plain.r) / 2);
    near(1 - zoomed.t - zoomed.b, 0.5); // now the height is cropped too
  });

  it("zooming around a point keeps that point of the picture in place", () => {
    const l = layer();
    const cx = 120;
    const cy = 200;
    const before = spinePlacement(l, count, rect);
    const u = (cx - before.left) / before.w;
    const v = (cy - before.top) / before.h;
    const z = spineZoomAt(l, count, rect, 3, cx, cy);
    const after = spinePlacement({ ...l, ...z }, count, rect, z.spineZoom, z.spineFocus);
    near(after.left + u * after.w, cx);
    near(after.top + v * after.h, cy);
  });

  it("dragging moves the picture by the dragged distance, up to its edge", () => {
    const l = layer({ spineZoom: 2 });
    const start = { x: 0.5, y: 0.5 };
    const f = spinePan(l, count, rect, start, 100, 0);
    const a = spinePlacement(l, count, rect, 2, start);
    const b = spinePlacement(l, count, rect, 2, f);
    near(b.left - a.left, 100);
    // dragged far beyond the edge: clamps, never leaves a gap
    const far = spinePan(l, count, rect, start, 1e6, -1e6);
    expect(far).toEqual({ x: 0, y: 1 });
    near(strip.w, 300);
  });

  it("an axis the picture doesn't overflow can't be dragged", () => {
    const f = spinePan(layer(), count, rect, { x: 0.5, y: 0.3 }, 0, 80);
    near(f.y, 0.3);
  });
});
