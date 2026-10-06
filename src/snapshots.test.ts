import { describe, expect, it } from "vitest";
import { newProject } from "./factory";
import {
  deleteSnapshot,
  listSnapshots,
  mapSnapshots,
  MAX_AUTO_SNAPSHOTS,
  saveSnapshot,
} from "./snapshots";

describe("snapshots", () => {
  it("lists a project's snapshots newest first, and only its own", async () => {
    const a = newProject("A");
    const b = newProject("B");
    const s1 = await saveSnapshot(a, "first");
    await new Promise((r) => setTimeout(r, 2));
    await saveSnapshot(a, "second");
    await saveSnapshot(b, "other");
    const list = await listSnapshots(a.id);
    expect(list.map((s) => s.name)).toEqual(["second", "first"]);
    await deleteSnapshot(s1);
    expect((await listSnapshots(a.id)).map((s) => s.name)).toEqual(["second"]);
  });

  it("caps automatic snapshots but keeps named ones", async () => {
    const p = newProject("P");
    await saveSnapshot(p, "mine");
    for (let i = 0; i < MAX_AUTO_SNAPSHOTS + 3; i++) {
      await saveSnapshot(p, `auto ${i}`, { auto: true });
    }
    const list = await listSnapshots(p.id);
    expect(list.filter((s) => s.auto)).toHaveLength(MAX_AUTO_SNAPSHOTS);
    expect(list.some((s) => s.name === "mine")).toBe(true);
  });

  it("mapSnapshots rewrites the stored copies", async () => {
    const p = newProject("P");
    await saveSnapshot(p, "x");
    await mapSnapshots((q) => ({ ...q, name: "moved" }));
    expect((await listSnapshots(p.id))[0].project.name).toBe("moved");
  });
});
