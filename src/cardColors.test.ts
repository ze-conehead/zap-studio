import { describe, expect, it } from "vitest";
import { colorsOnCard } from "./cardColors";
import { makeShapeLayer, makeTextLayer } from "./factory";

describe("colorsOnCard", () => {
  it("collects the colours of fills, gradient stops, strokes and text, most used first", () => {
    const a = { ...makeShapeLayer("rect"), fill: { kind: "solid", color: "#FF0000", noise: 0 }, stroke: "#00ff00", strokeWidth: 2 } as never;
    const b = { ...makeShapeLayer("circle"), fill: { kind: "gradient", stops: ["#ff0000", "#0000ff"], noise: 0 }, stroke: "#00ff00" } as never;
    const t = { ...makeTextLayer("hi"), color: "#ff0000" } as never;
    const colors = colorsOnCard([a, b, t]);
    expect(colors[0]).toBe("#ff0000"); // three uses, case folded
    expect(colors[1]).toBe("#00ff00"); // two
    expect(colors).toContain("#0000ff");
    expect(new Set(colors).size).toBe(colors.length);
  });

  it("ignores tokens, picture data and non-hex colours, and caps the list", () => {
    const l = { ...makeShapeLayer("rect"), fill: { kind: "solid", color: "{accent}", noise: 0 }, stroke: "red", src: "#123456" } as never;
    expect(colorsOnCard([l])).toEqual([]);
    const many = Array.from({ length: 30 }, (_, i) => ({ ...makeShapeLayer("rect"), stroke: `#${i.toString(16).padStart(6, "0")}` })) as never[];
    expect(colorsOnCard(many, 14)).toHaveLength(14);
  });
});
