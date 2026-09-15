import { beforeEach, describe, expect, it } from "vitest";
import {
  fitImageToMask,
  makeAlphaMaskLayer,
  makeImageLayer,
  newConsoleTemplate,
  newGlobalTemplate,
  newProject,
} from "./factory";
import { sweepMaskMove } from "./maskSweep";
import { deleteProject, loadAllProjects, loadProject, saveProject } from "./persist";
import type { ImageLayer } from "./types";

const img = (extra: Partial<ImageLayer>): ImageLayer => ({
  ...makeImageLayer({ src: "data:,", naturalWidth: 400, naturalHeight: 300, name: "cover" }),
  ...extra,
});

beforeEach(async () => {
  for (const p of await loadAllProjects()) await deleteProject(p.id);
});

describe("sweepMaskMove", () => {
  it("re-fits every image linked to the moved global mask — by maskId or legacy main", async () => {
    const mask = makeAlphaMaskLayer(1);
    await saveProject({ ...newGlobalTemplate(), layers: [mask] });
    const byId = { ...newProject("a"), gameKey: "ps/a", layers: [fitImageToMask(img({ maskId: mask.id }), mask)] };
    const legacy = { ...newProject("b"), gameKey: "ps/b", layers: [fitImageToMask(img({ main: true }), mask)] };
    const unrelated = { ...newProject("c"), gameKey: "ps/c", layers: [img({ x: 1, y: 2 })] };
    for (const p of [byId, legacy, unrelated]) await saveProject(p);

    const moved = { ...mask, x: mask.x + 100, y: mask.y - 50, width: mask.width * 1.5 };
    const touched = await sweepMaskMove(moved);
    expect(touched).toBe(2);
    const expected = fitImageToMask(img({ maskId: mask.id }), moved);
    for (const p of [byId, legacy]) {
      const l = (await loadProject(p.id))!.layers[0];
      expect([l.x, l.y, (l as ImageLayer).width]).toEqual([expected.x, expected.y, expected.width]);
    }
    expect((await loadProject(unrelated.id))!.layers[0]).toMatchObject({ x: 1, y: 2 });
  });

  it("a console mask only reaches that console's cards, and the excluded project is skipped", async () => {
    const mask = makeAlphaMaskLayer(1);
    await saveProject({ ...newConsoleTemplate("ps", "PlayStation"), layers: [mask] });
    const ps = { ...newProject("ps card"), gameKey: "ps/x", layers: [img({ maskId: mask.id })] };
    const n64 = { ...newProject("n64 card"), gameKey: "n64/y", layers: [img({ maskId: mask.id })] };
    const skipped = { ...newProject("skipped"), gameKey: "ps/z", layers: [img({ maskId: mask.id })] };
    for (const p of [ps, n64, skipped]) await saveProject(p);

    const touched = await sweepMaskMove({ ...mask, x: mask.x + 40 }, skipped.id);
    expect(touched).toBe(1);
    expect((await loadProject(n64.id))!.layers[0].x).toBe(n64.layers[0].x);
    expect((await loadProject(skipped.id))!.layers[0].x).toBe(skipped.layers[0].x);
    expect((await loadProject(ps.id))!.layers[0].x).not.toBe(ps.layers[0].x);
  });
});
