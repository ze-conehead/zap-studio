import { describe, expect, it } from "vitest";
import { PX_PER_MM, TRIM_RECT } from "./card";
import { makeImageLayer, makeTextLayer, newProject } from "./factory";
import { checkCards, type CheckContext } from "./preflight";
import type { Layer } from "./types";

const mid = { x: TRIM_RECT.x + TRIM_RECT.w / 2, y: TRIM_RECT.y + TRIM_RECT.h / 2 };
const none: CheckContext = { folds: [], features: [] };

const codes = (layers: Layer[], ctx: CheckContext) => {
  const p = newProject("card");
  p.layers = layers;
  return checkCards([{ name: "card", project: p, overlay: [] }], ctx).map((f) => f.code);
};

// A small 100 × 50 px text frame centred at x (a frame has a fixed height,
// so nothing needs measuring — jsdom has no canvas).
const text = (x: number): Layer => ({
  ...makeTextLayer("Hi"),
  fontSize: 40,
  width: 100,
  flow: true,
  height: 50,
  x,
  y: mid.y,
});

describe("preflight: folds", () => {
  const ctx: CheckContext = { folds: [{ x: mid.x, left: "Back", right: "Spine" }], features: [] };

  it("flags text across a fold, and text too close to one", () => {
    expect(codes([text(mid.x)], ctx)).toContain("on-fold");
    // right edge 1 mm short of the fold
    expect(codes([text(mid.x - 50 - PX_PER_MM)], ctx)).toContain("near-fold");
    expect(codes([text(mid.x - 50 - 5 * PX_PER_MM)], ctx)).not.toContain("near-fold");
  });

  it("counts a card once even when a layer crosses two folds", () => {
    const two: CheckContext = {
      folds: [
        { x: mid.x - 20, left: "Back", right: "Spine" },
        { x: mid.x + 20, left: "Spine", right: "Front" },
      ],
      features: [],
    };
    const p = newProject("card");
    p.layers = [text(mid.x)];
    const fs = checkCards([{ name: "card", project: p, overlay: [] }], two);
    expect(fs.filter((f) => f.code === "on-fold")).toHaveLength(1);
    expect(fs.find((f) => f.code === "on-fold")?.cards).toHaveLength(1);
  });

  it("lets pictures wrap across a fold", () => {
    const img = { ...makeImageLayer({ src: "x", naturalWidth: 3000, naturalHeight: 3000, name: "i" }), x: mid.x, y: mid.y };
    expect(codes([img], ctx)).not.toContain("on-fold");
  });
});

describe("preflight: shell features", () => {
  it("flags text on a hole or under an edge", () => {
    const hole: CheckContext = {
      folds: [],
      features: [{ kind: "hole", xMM: TRIM_RECT.w / 2 / PX_PER_MM, yMM: TRIM_RECT.h / 2 / PX_PER_MM, rMM: 3 }],
    };
    expect(codes([text(mid.x)], hole)).toContain("under-feature");
    expect(codes([text(mid.x)], none)).not.toContain("under-feature");

    const edge: CheckContext = { folds: [], features: [{ kind: "edge", side: "top", sizeMM: 4 }] };
    const high = { ...text(mid.x), y: TRIM_RECT.y + 6 * PX_PER_MM };
    expect(codes([high], edge)).toContain("under-feature");
  });
});

describe("preflight: spine background", () => {
  it("runs into the bleed on purpose", () => {
    const spine = {
      ...makeImageLayer({ src: "x", naturalWidth: 4000, naturalHeight: 4000, name: "s" }),
      spineBg: true,
      x: mid.x,
      y: mid.y,
      width: TRIM_RECT.w * 2,
      height: TRIM_RECT.h * 2,
    };
    expect(codes([spine], none)).not.toContain("outside-trim");
  });
});
