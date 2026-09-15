import { beforeEach, describe, expect, it, vi } from "vitest";
import { changeBleed, currentBleedMM } from "./bleed";
import { PX_PER_MM } from "./card";
import { makeImageLayer, makeTextLayer, newGlobalTemplate, newProject } from "./factory";
import { getBleedOverride, getFormat } from "./formats";
import { loadGuides, saveGuides } from "./guides";
import { deleteProject, listTrash, loadAllProjects, loadProject, saveProject } from "./persist";

const px = (mm: number) => Math.round(mm * PX_PER_MM);

beforeEach(async () => {
  vi.stubGlobal("location", { ...location, reload: vi.fn() });
  for (const p of await loadAllProjects()) await deleteProject(p.id);
});

describe("changeBleed", () => {
  it("moves every layer, back face, trashed project and guide by the bleed difference", async () => {
    const card = { ...newProject("card"), layers: [makeTextLayer("t")], back: { layers: [makeTextLayer("b")] } };
    const global = { ...newGlobalTemplate(), layers: [makeImageLayer({ src: "data:,", naturalWidth: 1, naturalHeight: 1, name: "g" })] };
    await saveProject(card);
    await saveProject(global);
    const trashed = { ...newProject("old"), layers: [makeTextLayer("gone")] };
    await saveProject(trashed);
    await deleteProject(trashed.id);
    saveGuides({ on: true, locked: false, snap: true, items: [{ id: "g1", axis: "x", pos: 100 }] });
    const before = {
      card: card.layers[0].x,
      back: card.back.layers[0].y,
      global: global.layers[0].x,
      trash: trashed.layers[0].x,
    };

    await changeBleed(1);

    const d = px(1) - px(3);
    expect(d).toBeLessThan(0);
    expect((await loadProject(card.id))!.layers[0].x).toBe(before.card + d);
    expect((await loadProject(card.id))!.back!.layers[0].y).toBe(before.back + d);
    // Loading backfills the global template's background layer at index 0.
    expect((await loadProject(global.id))!.layers.find((l) => l.type === "image")!.x).toBe(before.global + d);
    expect((await listTrash())[0].project.layers[0].x).toBe(before.trash + d);
    expect(loadGuides().items[0].pos).toBe(100 + d);
    expect(getBleedOverride()).toBe(1);
    expect(getFormat().bleedMM).toBe(1);
    expect(location.reload).toHaveBeenCalled();
  });

  it("drops the override when set back to the format's own bleed, and keeps the last project", async () => {
    const a = newProject("a");
    const b = newProject("b");
    await saveProject(a);
    await saveProject(b); // b is the last one opened
    await changeBleed(2);
    expect(getBleedOverride()).toBe(2);
    expect(localStorage.getItem("lastProjectId")).toBe(b.id);
    await changeBleed(3);
    expect(getBleedOverride()).toBeUndefined();
    expect(currentBleedMM()).toBe(3);
  });

  it("a no-op change touches nothing", async () => {
    const p = { ...newProject("p"), layers: [makeTextLayer("t")], updatedAt: 1 };
    await saveProject(p);
    await changeBleed(3);
    expect((await loadProject(p.id))!.updatedAt).toBe(1);
  });
});
