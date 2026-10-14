import { describe, expect, it } from "vitest";
import { dominantAxis, snapBox, withoutAxis, type SnapLines } from "./snapping";

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
