import { describe, expect, it } from "vitest";
import {
  combineAfterResize,
  combinedBounds,
  makeCombineShape,
  operandBounds,
  operandsOf,
  scaleCombine,
  visibleBounds,
} from "./combineShape";
import type { CombineShape } from "./types";

describe("operandsOf", () => {
  it("a plain shape is just its own box, always adding", () => {
    const ops = operandsOf({ shape: "rect", width: 100, height: 60, cornerRadius: 8 });
    expect(ops).toEqual([
      { shape: "rect", op: "add", x: 0, y: 0, width: 100, height: 60, rotation: 0, cornerRadius: 8 },
    ]);
  });

  it("rounds a capsule's corners to half its shorter side, plain and as a part", () => {
    const part: CombineShape = {
      id: "c1", shape: "capsule", op: "add", x: 10, y: 0, width: 40, height: 20, rotation: 0, cornerRadius: 99,
    };
    expect(operandsOf({ shape: "capsule", width: 80, height: 30, cornerRadius: 0 })[0].cornerRadius).toBe(15);
    const ops = operandsOf({ shape: "combined", width: 40, height: 20, cornerRadius: 0, combine: [part] });
    expect(ops).toHaveLength(1);
    expect(ops[0].cornerRadius).toBe(10); // min(40,20)/2, ignores the stored 99
  });

  it("a combined shape has no box of its own — just its parts, in order, each with its op", () => {
    const a: CombineShape = { id: "a", shape: "rect", op: "add", x: 20, y: 0, width: 10, height: 10, rotation: 0, cornerRadius: 0 };
    const b: CombineShape = { id: "b", shape: "circle", op: "subtract", x: -20, y: 0, width: 10, height: 10, rotation: 45, cornerRadius: 0 };
    const ops = operandsOf({ shape: "combined", width: 999, height: 999, cornerRadius: 0, combine: [a, b] });
    expect(ops.map((o) => o.op)).toEqual(["add", "subtract"]);
    expect(ops[1].rotation).toBe(45);
  });

  it("a combined shape with no parts is empty", () => {
    expect(operandsOf({ shape: "combined", width: 10, height: 10, cornerRadius: 0 })).toEqual([]);
  });
});

describe("combinedBounds", () => {
  it("is the parent's own box when there are no other operands", () => {
    const ops = operandsOf({ shape: "rect", width: 100, height: 60, cornerRadius: 0 });
    expect(combinedBounds(ops)).toEqual({ x: -50, y: -30, w: 100, h: 60 });
  });

  it("covers every part, wherever they sit", () => {
    const main: CombineShape = { id: "m", shape: "rect", op: "add", x: 0, y: 0, width: 100, height: 60, rotation: 0, cornerRadius: 0 };
    const child: CombineShape = { id: "c", shape: "rect", op: "add", x: 80, y: 0, width: 20, height: 20, rotation: 0, cornerRadius: 0 };
    const ops = operandsOf({ shape: "combined", width: 100, height: 60, cornerRadius: 0, combine: [main, child] });
    const b = combinedBounds(ops);
    expect(b.x).toBe(-50);
    expect(b.x + b.w).toBe(90); // child's right edge, 80 + 10
  });

  it("accounts for rotation via the operand's rotated corners", () => {
    // A 10×10 square rotated 45° has a ~14.14 corner-to-corner diagonal.
    const ops = operandsOf({ shape: "rect", width: 10, height: 10, cornerRadius: 0 });
    ops[0].rotation = 45;
    const b = combinedBounds(ops);
    expect(b.w).toBeCloseTo(Math.SQRT2 * 10, 5);
    expect(b.h).toBeCloseTo(Math.SQRT2 * 10, 5);
  });

  it("is empty for no operands at all", () => {
    expect(combinedBounds([])).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it("still counts a subtract-only operand toward the bounds (a safe superset)", () => {
    const main: CombineShape = { id: "m", shape: "rect", op: "add", x: 0, y: 0, width: 20, height: 20, rotation: 0, cornerRadius: 0 };
    const child: CombineShape = { id: "c", shape: "rect", op: "subtract", x: 200, y: 0, width: 10, height: 10, rotation: 0, cornerRadius: 0 };
    const ops = operandsOf({ shape: "combined", width: 20, height: 20, cornerRadius: 0, combine: [main, child] });
    const b = combinedBounds(ops);
    expect(b.x + b.w).toBeGreaterThan(200);
  });
});

describe("makeCombineShape", () => {
  it("sizes a new entry to fit inside the parent, centred", () => {
    const c = makeCombineShape("rect", "subtract", 100, 80);
    expect(c.x).toBe(0);
    expect(c.y).toBe(0);
    expect(c.op).toBe("subtract");
    expect(c.width).toBeLessThanOrEqual(100);
    expect(c.height).toBeLessThanOrEqual(80);
  });

  it("gives every entry its own id", () => {
    const a = makeCombineShape("circle", "add", 100, 100);
    const b = makeCombineShape("circle", "add", 100, 100);
    expect(a.id).not.toBe(b.id);
  });
});

const entry = (over: Partial<CombineShape> = {}): CombineShape => ({
  id: "e", shape: "rect", op: "add", x: 20, y: 10, width: 40, height: 20, rotation: 0, cornerRadius: 4, ...over,
});

describe("scaleCombine / combineAfterResize", () => {
  it("scales an entry's position and size with the main shape", () => {
    const [c] = scaleCombine([entry()], 2, 3);
    expect(c).toMatchObject({ x: 40, y: 30, width: 80, height: 60, cornerRadius: 4 });
  });

  it("a quarter-turned entry stretches along its own axes", () => {
    const [c] = scaleCombine([entry({ rotation: 90 })], 2, 3);
    expect(c.width).toBeCloseTo(40 * 3); // its width now runs along y
    expect(c.height).toBeCloseTo(20 * 2);
  });

  it("uniform scaling keeps a rotated entry's shape", () => {
    const [c] = scaleCombine([entry({ rotation: 33 })], 1.5, 1.5);
    expect(c.width).toBeCloseTo(60);
    expect(c.height).toBeCloseTo(30);
  });

  it("follows a width / height patch, and leaves everything alone otherwise", () => {
    const before = { width: 100, height: 50, combine: [entry()] };
    expect(combineAfterResize(before, { width: 200 })?.[0]).toMatchObject({ x: 40, y: 10, width: 80, height: 20 });
    expect(combineAfterResize(before, { height: 50 })).toBeUndefined(); // no change
    expect(combineAfterResize(before, {} as { width: number })).toBeUndefined();
    expect(combineAfterResize(before, { width: 200, combine: [] })).toBeUndefined(); // the patch decides
    expect(combineAfterResize({ width: 100, height: 50 }, { width: 200 })).toBeUndefined(); // nothing combined
  });
});

describe("visibleBounds", () => {
  it("covers the added parts only — a subtract entry never widens it", () => {
    const ops = operandsOf({
      shape: "combined",
      width: 100,
      height: 50,
      cornerRadius: 0,
      combine: [
        entry({ id: "main", x: 0, y: 0, width: 100, height: 50 }),
        entry({ x: 70, y: 0, width: 40, height: 40 }), // sticks out to the right
        entry({ id: "cut", op: "subtract", x: -90, y: 0, width: 60, height: 60 }), // cuts far to the left
      ],
    });
    const v = visibleBounds(ops);
    expect(v.x).toBeCloseTo(-50);
    expect(v.x + v.w).toBeCloseTo(90);
    expect(combinedBounds(ops).x).toBeLessThan(-100); // the generous box does include the cut
    expect(operandBounds(ops[1])).toMatchObject({ x: 50, w: 40 });
  });
});
