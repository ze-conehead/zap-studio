import { describe, expect, it } from "vitest";
import { makeShapeLayer, newProject } from "./factory";
import { reduceAt } from "./store";
import type { Action, State } from "./store";

const start = (): { state: State; id: string } => {
  const shape = makeShapeLayer("rect");
  const project = { ...newProject("t"), layers: [shape] };
  return {
    id: shape.id,
    state: { project, side: "front", selectedId: null, past: [], future: [], pending: null, showBleed: false, dirty: false },
  };
};

const patch = (id: string, p: Record<string, unknown>, history?: boolean): Action => ({
  type: "PATCH_LAYER",
  id,
  patch: p,
  ...(history === undefined ? {} : { history }),
});

describe("undo steps for quick runs of one edit", () => {
  it("a run of the same edit within 0.7 s is one undo step", () => {
    const { state, id } = start();
    let s = reduceAt(state, patch(id, { x: 10 }), 1000);
    s = reduceAt(s, patch(id, { x: 11 }), 1200);
    s = reduceAt(s, patch(id, { x: 12 }), 1500);
    expect(s.past).toHaveLength(1);
    expect((s.project.layers[0] as { x: number }).x).toBe(12);
    // …and one undo goes back to before the run
    const undone = reduceAt(s, { type: "UNDO" }, 1600);
    expect((undone.project.layers[0] as { x: number }).x).toBe(state.project.layers[0].x);
  });

  it("a pause, another field or another layer starts a new step", () => {
    const { state, id } = start();
    let s = reduceAt(state, patch(id, { x: 10 }), 1000);
    s = reduceAt(s, patch(id, { x: 11 }), 2000); // too late
    expect(s.past).toHaveLength(2);
    s = reduceAt(s, patch(id, { y: 5 }), 2100); // another field
    expect(s.past).toHaveLength(3);
    s = reduceAt(s, patch(id, { x: 12 }), 2200); // back to x, but the last edit was y
    expect(s.past).toHaveLength(4);
  });

  it("any other action in between ends the run", () => {
    const { state, id } = start();
    let s = reduceAt(state, patch(id, { x: 10 }), 1000);
    s = reduceAt(s, { type: "SELECT", id }, 1100);
    s = reduceAt(s, patch(id, { x: 11 }), 1200);
    expect(s.past).toHaveLength(2);
  });

  it("drags (history: false) keep working as before", () => {
    const { state, id } = start();
    let s = reduceAt(state, patch(id, { x: 10 }, false), 1000);
    s = reduceAt(s, patch(id, { x: 20 }, false), 1010);
    expect(s.past).toHaveLength(0);
    s = reduceAt(s, patch(id, { x: 30 }), 1020);
    expect(s.past).toHaveLength(1); // the drag as a whole, undone in one go
  });
});

describe("⌥-drag copies", () => {
  it("leaves a copy right under the original, same place, original still selected", () => {
    const { state, id } = start();
    const s = reduceAt({ ...state, selectedId: id }, { type: "CLONE_LAYER_IN_PLACE", id }, 1000);
    expect(s.project.layers).toHaveLength(2);
    const [copy, orig] = s.project.layers;
    expect(orig.id).toBe(id);
    expect(copy.id).not.toBe(id);
    expect([copy.x, copy.y]).toEqual([orig.x, orig.y]);
    expect(s.selectedId).toBe(id);
  });
});
