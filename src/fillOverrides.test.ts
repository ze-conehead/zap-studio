import { describe, expect, it } from "vitest";
import { backgroundFillOverride, setFillOverride, withFillOverride } from "./fillOverrides";
import { makeBackgroundLayer, makeShapeLayer, makeTextLayer } from "./factory";
import type { CardBackground, Project } from "./types";

const fill = (color: string): CardBackground => ({
  kind: "solid",
  color,
  color2: color,
  angle: 90,
  noise: 0,
});

describe("withFillOverride", () => {
  it("passes a layer through untouched when it doesn't allow overrides", () => {
    const shape = makeShapeLayer("rect");
    const descendant: Project = { fillOverrides: { [shape.id]: fill("#f00") } } as Project;
    expect(withFillOverride(shape, descendant)).toBe(shape);
  });

  it("passes through when the layer allows one but none was set", () => {
    const shape = { ...makeShapeLayer("rect"), editableFill: true };
    expect(withFillOverride(shape, { fillOverrides: {} } as Project)).toBe(shape);
    expect(withFillOverride(shape, undefined)).toBe(shape);
  });

  it("substitutes the descendant's own fill for an editable shape or background", () => {
    const red = fill("#f00");
    const shape = { ...makeShapeLayer("rect"), editableFill: true };
    const bg = { ...makeBackgroundLayer(), editableFill: true };
    const descendant = { fillOverrides: { [shape.id]: red, [bg.id]: red } } as Project;
    const outShape = withFillOverride(shape, descendant);
    const outBg = withFillOverride(bg, descendant);
    expect(outShape.type === "shape" && outShape.fill).toBe(red);
    expect(outBg.type === "background" && outBg.fill).toBe(red);
    // Nothing else about the layer changes.
    expect(outShape).toMatchObject({ id: shape.id, width: shape.width });
  });

  it("never touches a text layer's fill, even if it were flagged", () => {
    const text = { ...makeTextLayer("x"), editableFill: true };
    const before = text.fill;
    const out = withFillOverride(text, { fillOverrides: { [text.id]: fill("#0f0") } } as Project);
    expect(out.type === "text" && out.fill).toBe(before); // a string colour, not swapped for a CardBackground
  });
});

describe("backgroundFillOverride", () => {
  it("mirrors withFillOverride for a bare {id, fill, editableFill}", () => {
    const bg = { id: "bg1", fill: fill("#111"), editableFill: true };
    expect(backgroundFillOverride(bg, { fillOverrides: { bg1: fill("#f00") } })).toEqual(fill("#f00"));
    expect(backgroundFillOverride(bg, { fillOverrides: {} })).toEqual(bg.fill);
    expect(backgroundFillOverride({ ...bg, editableFill: false }, { fillOverrides: { bg1: fill("#f00") } })).toEqual(bg.fill);
    expect(backgroundFillOverride(undefined, {})).toBeUndefined();
  });
});

describe("setFillOverride", () => {
  it("adds, replaces and clears one layer's override", () => {
    let p = { fillOverrides: undefined } as unknown as Project;
    p = setFillOverride(p, "l1", fill("#f00"));
    expect(p.fillOverrides).toEqual({ l1: fill("#f00") });
    p = setFillOverride(p, "l1", fill("#0f0"));
    expect(p.fillOverrides).toEqual({ l1: fill("#0f0") });
    p = setFillOverride(p, "l1", undefined);
    expect(p.fillOverrides).toBeUndefined(); // empty map collapses to undefined
  });

  it("keeps other layers' overrides when clearing one", () => {
    let p = { fillOverrides: undefined } as unknown as Project;
    p = setFillOverride(p, "a", fill("#f00"));
    p = setFillOverride(p, "b", fill("#0f0"));
    p = setFillOverride(p, "a", undefined);
    expect(p.fillOverrides).toEqual({ b: fill("#0f0") });
  });
});
