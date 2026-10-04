import { describe, expect, it } from "vitest";
import { makeImageLayer } from "./factory";
import { resolveSpineLayer, spineCountOf } from "./spine";
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
