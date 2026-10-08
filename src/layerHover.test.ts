import { describe, expect, it } from "vitest";
import { makeBackgroundLayer, makeConditionLayer, makeQrLayer, makeShapeLayer } from "./factory";
import { layerSize } from "./layerBounds";
import { getHoveredLayer, setHoveredLayer, subscribeHoveredLayer } from "./layerHover";

describe("layerSize", () => {
  it("is the box with the layer's scale applied", () => {
    const s = { ...makeShapeLayer("rect"), width: 200, height: 100, scaleX: 2, scaleY: -0.5 };
    expect(layerSize(s)).toEqual({ w: 400, h: 50 });
    const q = makeQrLayer();
    expect(layerSize(q)).toEqual({ w: q.width, h: q.height });
  });

  it("is null for layers without a box of their own", () => {
    expect(layerSize(makeConditionLayer())).toBeNull();
    expect(layerSize(makeBackgroundLayer())).toBeNull();
    expect(layerSize({ ...makeShapeLayer("rect"), width: 0 })).toBeNull();
  });
});

describe("hovered layer", () => {
  it("notifies once per change, and not at all when nothing changed", () => {
    const seen: (string | null)[] = [];
    const off = subscribeHoveredLayer(() => seen.push(getHoveredLayer()));
    setHoveredLayer("a");
    setHoveredLayer("a"); // same row again: no news
    setHoveredLayer("b");
    setHoveredLayer(null);
    off();
    setHoveredLayer("c"); // nobody listening any more
    setHoveredLayer(null);
    expect(seen).toEqual(["a", "b", null]);
  });
});
