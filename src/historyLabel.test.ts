import { describe, expect, it } from "vitest";
import { makeShapeLayer, makeTextLayer, newProject } from "./factory";
import { describeChange } from "./historyLabel";

const base = () => {
  const p = newProject("p");
  const text = makeTextLayer("Hello");
  const box = makeShapeLayer("rect");
  return { p: { ...p, layers: [text, box] }, text, box };
};

describe("describeChange", () => {
  it("names added, removed, moved, resized and styled layers", () => {
    const { p, text, box } = base();
    const extra = makeTextLayer("More");
    expect(describeChange(p, { ...p, layers: [...p.layers, extra] })).toBe("Added “More”");
    expect(describeChange(p, { ...p, layers: [text] })).toBe(`Removed “${box.name}”`);
    expect(describeChange(p, { ...p, layers: [{ ...text, x: 1 }, box] })).toBe("Moved “Hello”");
    expect(describeChange(p, { ...p, layers: [text, { ...box, width: 9, x: 3 }] })).toBe(`Resized “${box.name}”`);
    expect(describeChange(p, { ...p, layers: [{ ...text, fill: "#f00", bold: false }, box] })).toBe("Changed “Hello”");
    expect(describeChange(p, { ...p, layers: [{ ...text, visible: false }, box] })).toBe("Hid “Hello”");
    expect(describeChange(p, { ...p, layers: [{ ...text, text: "x" }, box] })).toBe("Edited text of “Hello”");
  });

  it("recognises reorders, renames, several layers and the back side", () => {
    const { p, text, box } = base();
    expect(describeChange(p, { ...p, layers: [box, text] })).toBe("Reordered layers");
    expect(describeChange(p, { ...p, name: "New" })).toBe("Renamed to “New”");
    expect(describeChange(p, { ...p, layers: [{ ...text, x: 1 }, { ...box, x: 1 }] })).toBe("Changed 2 layers");
    expect(describeChange(p, { ...p, back: { layers: [] } })).toBe("Added the back side");
    expect(describeChange(p, p)).toBe("Other change");
  });
});
