import { describe, expect, it } from "vitest";
import { canJoin, extractPart, mergeIntoCombined } from "./combined";
import { isCombined, legacyToCombined, operandsOf, recenterCombined, visibleBounds } from "./combineShape";
import { makeCombinedLayer, makeShapeLayer, migrateProject, newProject } from "./factory";
import type { CombineShape, ShapeLayer } from "./types";

const part = (over: Partial<CombineShape> = {}): CombineShape => ({
  id: Math.random().toString(16).slice(2),
  shape: "rect",
  op: "add",
  x: 0,
  y: 0,
  width: 100,
  height: 60,
  rotation: 0,
  cornerRadius: 0,
  ...over,
});

const container = (combine: CombineShape[], over: Partial<ShapeLayer> = {}): ShapeLayer => ({
  ...makeCombinedLayer(),
  x: 300,
  y: 400,
  combine,
  ...over,
});

const worldBox = (l: ShapeLayer) => {
  const b = visibleBounds(operandsOf(l));
  return { x1: l.x + b.x * l.scaleX, y1: l.y + b.y * l.scaleY, x2: l.x + (b.x + b.w) * l.scaleX, y2: l.y + (b.y + b.h) * l.scaleY };
};

describe("makeCombinedLayer", () => {
  it("has no outline of its own, only one starter part", () => {
    const l = makeCombinedLayer();
    expect(isCombined(l)).toBe(true);
    expect(l.combine).toHaveLength(1);
    expect(l.width).toBeCloseTo(l.combine![0].width);
  });
});

describe("recenterCombined", () => {
  it("centres the layer on what its parts show, without moving anything on screen", () => {
    const l = container([part({ x: 0 }), part({ x: 200, width: 40 })]); // spans -50 … 220
    const before = worldBox(l);
    const c = recenterCombined(l);
    const after = worldBox(c);
    expect(after.x1).toBeCloseTo(before.x1);
    expect(after.x2).toBeCloseTo(before.x2);
    expect(after.y1).toBeCloseTo(before.y1);
    // …and the layer's own box is now centred on its position
    const b = visibleBounds(operandsOf(c));
    expect(b.x + b.w / 2).toBeCloseTo(0);
    expect(c.width).toBeCloseTo(270);
    expect(c.height).toBeCloseTo(60);
    expect(c.x).toBeCloseTo(300 + 85);
  });

  it("copes with a rotated, scaled layer", () => {
    const l = container([part({ x: 0 }), part({ x: 100, y: 0 })], { rotation: 90, scaleX: 2, scaleY: 2 });
    const c = recenterCombined(l);
    // local centre (50, 0) → world: rotate 90° after scaling ×2 = (0, 100)
    expect(c.x).toBeCloseTo(300);
    expect(c.y).toBeCloseTo(500);
  });

  it("leaves a layer whose box is already right, and an empty one, alone", () => {
    const ok = recenterCombined(container([part()]));
    expect(recenterCombined(ok)).toBe(ok);
    const empty = container([]);
    expect(recenterCombined(empty)).toBe(empty);
  });
});

describe("legacyToCombined / migrateProject", () => {
  const legacy = (): ShapeLayer => ({
    ...makeShapeLayer("circle"),
    x: 200,
    y: 200,
    width: 100,
    height: 100,
    combine: [part({ x: 100, width: 40, height: 40, shape: "rect" })],
  });

  it("turns a shape with extra shapes into a combined shape that looks the same", () => {
    const l = legacy();
    const c = legacyToCombined(l) as ShapeLayer;
    expect(c.shape).toBe("combined");
    expect(c.combine).toHaveLength(2);
    expect(c.combine![0]).toMatchObject({ shape: "circle", op: "add", width: 100, height: 100 });
    const b = worldBox(c);
    expect(b.x1).toBeCloseTo(200 - 50); // the circle's left edge
    expect(b.x2).toBeCloseTo(200 + 100 + 20); // the extra square's right edge
  });

  it("leaves plain shapes alone", () => {
    const p = makeShapeLayer("rect");
    expect(legacyToCombined(p)).toBe(p);
  });

  it("migrates on both faces when a project loads", () => {
    const p = { ...newProject("t"), layers: [legacy()] };
    p.back = { layers: [legacy()] } as typeof p.back;
    const m = migrateProject(p);
    expect((m.layers[0] as ShapeLayer).shape).toBe("combined");
    expect((m.back!.layers[0] as ShapeLayer).shape).toBe("combined");
    expect(migrateProject(m).layers[0]).toBe(m.layers[0]); // nothing left to migrate
  });
});

describe("mergeIntoCombined / canJoin", () => {
  it("adds a shape as a part, standing exactly where the shape stood", () => {
    const c = container([part({ x: 0, width: 100, height: 100 })]);
    const s = { ...makeShapeLayer("circle"), x: 500, y: 450, width: 60, height: 60 };
    const m = mergeIntoCombined(c, s);
    expect(m.combine).toHaveLength(2);
    const b = worldBox(m);
    expect(b.x2).toBeCloseTo(530); // the circle's right edge on the card
    expect(b.x1).toBeCloseTo(250); // the first part's left edge (300 − 50)
    expect(b.y2).toBeCloseTo(480);
    expect(m.combine![1]).toMatchObject({ shape: "circle", op: "add", name: s.name });
  });

  it("follows the container's rotation", () => {
    const c = container([part({ width: 100, height: 100 })], { rotation: 90 });
    const s = { ...makeShapeLayer("rect"), x: 300, y: 500, width: 40, height: 40 }; // 100 below the container
    const m = mergeIntoCombined(c, s);
    // below in world = along the container's local x once it is turned 90° (x' = +100)
    const added = m.combine![1];
    const world = {
      x: m.x + (added.x * Math.cos(Math.PI / 2) - added.y * Math.sin(Math.PI / 2)),
      y: m.y + (added.x * Math.sin(Math.PI / 2) + added.y * Math.cos(Math.PI / 2)),
    };
    expect(world.x).toBeCloseTo(300);
    expect(world.y).toBeCloseTo(500);
    expect(added.rotation).toBeCloseTo(-90);
  });

  it("another combined shape brings all its parts", () => {
    const a = container([part(), part({ x: 80 })]);
    const b = container([part({ shape: "circle" }), part({ op: "subtract" })], { x: 600, y: 700 });
    const m = mergeIntoCombined(a, b);
    expect(m.combine).toHaveLength(4);
    expect(m.combine!.map((c) => c.op)).toEqual(["add", "add", "add", "subtract"]);
    expect(new Set(m.combine!.map((c) => c.id)).size).toBe(4); // fresh ids
  });

  it("only a combined shape accepts, and never a frame or itself", () => {
    const c = container([part()]);
    const plain = makeShapeLayer("rect");
    expect(canJoin(c, plain)).toBe(true);
    expect(canJoin(plain, c)).toBe(false);
    expect(canJoin(c, c)).toBe(false);
    expect(canJoin(c, { ...plain, alphaMask: true })).toBe(false);
    expect(canJoin(c, { ...plain, logoSlot: true })).toBe(false);
  });
});

describe("extractPart", () => {
  it("takes a part out as its own shape, where it stood and painted like the container", () => {
    const c = recenterCombined(
      container([part({ x: 0 }), part({ shape: "circle", x: 200, width: 40, height: 40 })], {
        fill: { kind: "solid", color: "#ff0000", noise: 0 } as ShapeLayer["fill"],
        strokeWidth: 3,
      }),
    );
    const before = worldBox(c);
    const out = extractPart(c, 1)!;
    expect(out.shape.shape).toBe("circle");
    expect(out.shape.fill).toBe(c.fill);
    expect(out.shape.strokeWidth).toBe(3);
    expect(out.shape.x).toBeCloseTo(before.x2 - 20); // the circle's centre
    expect(out.shape.width).toBeCloseTo(40);
    expect(out.container.combine).toHaveLength(1);
    expect(out.container.width).toBeCloseTo(100); // recentred on what's left
  });

  it("refuses an index that isn't there", () => {
    expect(extractPart(container([part()]), 5)).toBeNull();
  });
});
