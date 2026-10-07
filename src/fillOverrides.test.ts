import { describe, expect, it } from "vitest";
import { backgroundFillOverride, canOverrideStyle, setFillOverride, withFillOverride } from "./fillOverrides";
import { makeAlphaMaskLayer, makeBackgroundLayer, makeLogoSlotLayer, makeShapeLayer, makeTextLayer } from "./factory";
import type { CardBackground, Project } from "./types";

const fill = (color: string): CardBackground => ({
  kind: "solid",
  color,
  color2: color,
  angle: 90,
  noise: 0,
});

describe("withFillOverride", () => {
  it("passes a layer through untouched when nothing was overridden", () => {
    const shape = makeShapeLayer("rect");
    expect(withFillOverride(shape, { fillOverrides: {} } as Project)).toBe(shape);
    expect(withFillOverride(shape, undefined)).toBe(shape);
  });

  it("substitutes the descendant's own fill for any shape or background", () => {
    const red = fill("#f00");
    const shape = makeShapeLayer("rect");
    const bg = makeBackgroundLayer();
    const descendant = {
      fillOverrides: { [shape.id]: { fill: red }, [bg.id]: { fill: red } },
    } as Project;
    const outShape = withFillOverride(shape, descendant);
    const outBg = withFillOverride(bg, descendant);
    expect(outShape.type === "shape" && outShape.fill).toBe(red);
    expect(outBg.type === "background" && outBg.fill).toBe(red);
    // Nothing else about the layer changes.
    expect(outShape).toMatchObject({ id: shape.id, width: shape.width });
  });

  it("also overrides a shape's stroke and stroke width", () => {
    const shape = makeShapeLayer("rect");
    const descendant = {
      fillOverrides: { [shape.id]: { stroke: "#00f", strokeWidth: 5 } },
    } as Project;
    const out = withFillOverride(shape, descendant);
    expect(out.type === "shape" && out.stroke).toBe("#00f");
    expect(out.type === "shape" && out.strokeWidth).toBe(5);
    // Fill wasn't part of the patch, so it stays the layer's own.
    expect(out.type === "shape" && out.fill).toBe(shape.fill);
  });

  it("never touches a text layer's fill, even if one was set for its id", () => {
    const text = makeTextLayer("x");
    const before = text.fill;
    const out = withFillOverride(text, { fillOverrides: { [text.id]: { fill: fill("#0f0") } } } as Project);
    expect(out.type === "text" && out.fill).toBe(before); // a string colour, not swapped for a CardBackground
  });
});

describe("backgroundFillOverride", () => {
  it("mirrors withFillOverride for a bare {id, fill}", () => {
    const bg = { id: "bg1", fill: fill("#111") };
    expect(backgroundFillOverride(bg, { fillOverrides: { bg1: { fill: fill("#f00") } } })).toEqual(fill("#f00"));
    expect(backgroundFillOverride(bg, { fillOverrides: {} })).toEqual(bg.fill);
    expect(backgroundFillOverride(undefined, {})).toBeUndefined();
  });
});

describe("setFillOverride", () => {
  it("adds, replaces and clears one layer's override", () => {
    let p = { fillOverrides: undefined } as unknown as Project;
    p = setFillOverride(p, "l1", { fill: fill("#f00") });
    expect(p.fillOverrides).toEqual({ l1: { fill: fill("#f00") } });
    p = setFillOverride(p, "l1", { fill: fill("#0f0") });
    expect(p.fillOverrides).toEqual({ l1: { fill: fill("#0f0") } });
    p = setFillOverride(p, "l1", undefined);
    expect(p.fillOverrides).toBeUndefined(); // empty map collapses to undefined
  });

  it("keeps other layers' overrides when clearing one", () => {
    let p = { fillOverrides: undefined } as unknown as Project;
    p = setFillOverride(p, "a", { fill: fill("#f00") });
    p = setFillOverride(p, "b", { fill: fill("#0f0") });
    p = setFillOverride(p, "a", undefined);
    expect(p.fillOverrides).toEqual({ b: { fill: fill("#0f0") } });
  });

  it("merges a patch into an existing override instead of replacing it", () => {
    let p = { fillOverrides: undefined } as unknown as Project;
    p = setFillOverride(p, "l1", { fill: fill("#f00") });
    p = setFillOverride(p, "l1", { stroke: "#00f" });
    expect(p.fillOverrides).toEqual({ l1: { fill: fill("#f00"), stroke: "#00f" } });
  });
});

describe("placement frames can't be overridden", () => {
  it("allows shapes and backgrounds, not alpha masks or the logo slot", () => {
    expect(canOverrideStyle(makeShapeLayer("rect"))).toBe(true);
    expect(canOverrideStyle(makeBackgroundLayer())).toBe(true);
    expect(canOverrideStyle(makeAlphaMaskLayer(1))).toBe(false);
    expect(canOverrideStyle({ ...makeAlphaMaskLayer(1), shotOnly: true })).toBe(false);
    expect(canOverrideStyle(makeLogoSlotLayer())).toBe(false);
    expect(canOverrideStyle(makeTextLayer("x"))).toBe(false);
  });

  it("ignores an override an older version stored for a frame", () => {
    const mask = makeAlphaMaskLayer(1);
    const descendant = { fillOverrides: { [mask.id]: { fill: fill("#f00"), stroke: "#0f0" } } } as Project;
    expect(withFillOverride(mask, descendant)).toBe(mask);
  });
});
