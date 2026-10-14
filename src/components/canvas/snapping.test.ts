import { describe, expect, it } from "vitest";
import { dominantAxis, snapBox, snapResizeBox, withoutAxis, type SnapLines, type TransformBox } from "./snapping";

const lines = (over: Partial<SnapLines> = {}): SnapLines => ({ xs: [], ys: [], smartX: [], smartY: [], tol: 7, ...over });

describe("snapBox", () => {
  it("nudges the nearest edge or centre onto a line within the tolerance", () => {
    const r = snapBox({ x: 96, y: 10, width: 40, height: 20 }, lines({ smartX: [100], smartY: [200] }));
    expect(r.dx).toBe(4); // left edge 96 → 100
    expect(r.dy).toBe(0); // 200 is too far
    expect(r.hit.smartX).toEqual([100]);
    expect(r.hit.smartY).toEqual([]);
  });

  it("uses the box's centre and right edge too", () => {
    expect(snapBox({ x: 0, y: 0, width: 100, height: 10 }, lines({ smartX: [53] })).dx).toBe(3); // centre 50 → 53
    expect(snapBox({ x: 0, y: 0, width: 100, height: 10 }, lines({ smartX: [96] })).dx).toBe(-4); // right 100 → 96
  });

  it("an explicit guide beats an alignment line at the same distance", () => {
    const r = snapBox({ x: 10, y: 0, width: 10, height: 10 }, lines({ xs: [12], smartX: [8] }));
    expect(r.dx).toBe(2);
    expect(r.hit.xs).toEqual([12]);
  });

  it("does nothing out of reach", () => {
    expect(snapBox({ x: 0, y: 0, width: 10, height: 10 }, lines({ smartX: [50], smartY: [50] }))).toMatchObject({ dx: 0, dy: 0 });
  });
});

describe("Shift axis lock", () => {
  it("keeps the axis dragged further", () => {
    expect(dominantAxis(30, 5)).toBe("x");
    expect(dominantAxis(-4, 20)).toBe("y");
    expect(dominantAxis(7, -7)).toBe("x"); // tie → horizontal
  });

  it("drops the highlight on the held axis", () => {
    const hit = { xs: [1], ys: [2], smartX: [3], smartY: [4] };
    expect(withoutAxis(hit, "y")).toEqual({ xs: [1], ys: [], smartX: [3], smartY: [] });
    expect(withoutAxis(hit, "x")).toEqual({ xs: [], ys: [2], smartX: [], smartY: [4] });
    expect(withoutAxis(hit, null)).toBe(hit);
  });
});

describe("snapResizeBox", () => {
  // stage px = canvas px × 0.5, reach = 10 screen px
  const scale = 0.5;
  const lns = (over: Partial<SnapLines> = {}): SnapLines => ({ xs: [], ys: [], smartX: [], smartY: [], tol: 10 / scale, ...over });
  const box = (x: number, y: number, width: number, height: number): TransformBox => ({ x, y, width, height, rotation: 0 });

  it("snaps the edge a side handle drags, and nothing else", () => {
    // right edge of the box: 100 + 150 = 250 stage px = canvas 500; the line is canvas 510 → 255 stage px
    const old = box(100, 50, 140, 80);
    const next = box(100, 50, 150, 80);
    const r = snapResizeBox(old, next, "middle-right", lns({ smartX: [510] }), scale);
    expect(r.box).toMatchObject({ x: 100, width: 155, y: 50, height: 80 });
    expect(r.hit.smartX).toEqual([510]);
  });

  it("a left handle moves x and keeps the right edge where it was", () => {
    const old = box(100, 50, 200, 80);
    const next = box(94, 50, 206, 80); // left edge dragged to 94 stage px = canvas 188
    const r = snapResizeBox(old, next, "middle-left", lns({ xs: [190] }), scale); // guide at stage 95
    expect(r.box.x).toBeCloseTo(95);
    expect(r.box.x + r.box.width).toBeCloseTo(300); // right edge unchanged
    expect(r.hit.xs).toEqual([190]); // a placed guide, not an alignment line
  });

  it("leaves the edges alone that the handle does not move", () => {
    // a line sits right at the unmoved top edge — no pull on it
    const r = snapResizeBox(box(100, 50, 140, 80), box(100, 50, 150, 80), "middle-right", lns({ smartY: [100], smartX: [999] }), scale);
    expect(r.box.y).toBe(50);
    expect(r.hit.smartY).toEqual([]);
  });

  it("a corner drag that keeps the ratio keeps it when one edge snaps", () => {
    const old = box(100, 100, 100, 50); // 2:1
    const next = box(100, 100, 120, 60);
    // right edge at 220 stage = canvas 440; the line is canvas 444 → stage 222
    const r = snapResizeBox(old, next, "bottom-right", lns({ smartX: [444] }), scale);
    expect(r.box.width).toBeCloseTo(122);
    expect(r.box.height).toBeCloseTo(61); // 2:1 still
  });

  it("a top-left corner keeps the opposite corner fixed while the ratio follows", () => {
    const old = box(100, 100, 100, 50);
    const next = box(80, 90, 120, 60); // dragged up-left, 2:1
    const r = snapResizeBox(old, next, "top-left", lns({ smartX: [158] }), scale); // stage 79
    expect(r.box.x).toBeCloseTo(79);
    expect(r.box.x + r.box.width).toBeCloseTo(200);
    expect(r.box.y + r.box.height).toBeCloseTo(150);
    expect(r.box.width / r.box.height).toBeCloseTo(2);
  });

  it("does nothing out of reach, when rotated, or on the rotation handle", () => {
    const old = box(100, 50, 140, 80);
    const next = box(100, 50, 150, 80);
    expect(snapResizeBox(old, next, "middle-right", lns({ smartX: [900] }), scale).box).toEqual(next);
    expect(snapResizeBox({ ...old, rotation: 0.3 }, { ...next, rotation: 0.3 }, "middle-right", lns({ smartX: [510] }), scale).box).toEqual({ ...next, rotation: 0.3 });
    expect(snapResizeBox(old, next, "rotater", lns({ smartX: [510] }), scale).box).toBe(next);
    expect(snapResizeBox(old, next, null, lns({ smartX: [510] }), scale).box).toBe(next);
  });

  it("will not squash a box below the minimum size", () => {
    const r = snapResizeBox(box(100, 50, 30, 80), box(100, 50, 20, 80), "middle-right", lns({ smartX: [202] }), scale); // would give width 2
    expect(r.box.width).toBe(20);
  });
});
