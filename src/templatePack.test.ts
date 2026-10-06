import { describe, expect, it } from "vitest";
import { getCatalog } from "./data/catalog";
import { GLOBAL_TEMPLATE_ID, makeTextLayer, newConsoleTemplate, newGlobalTemplate, templateId } from "./factory";
import { loadProject, saveProject } from "./persist";
import { listSnapshots } from "./snapshots";
import { buildPack, importPack, listTemplates, readPack } from "./templatePack";

describe("template packs", () => {
  it("round-trips templates, snapshots what they replace and adds missing consoles", async () => {
    const g = newGlobalTemplate();
    g.layers = [...g.layers, { ...makeTextLayer("GLOBAL"), name: "g-text" }];
    await saveProject(g);
    const c = getCatalog()[0];
    const ct = newConsoleTemplate(c.id, c.name);
    ct.layers = [{ ...makeTextLayer("CONSOLE"), name: "c-text" }];
    await saveProject(ct);

    const list = await listTemplates();
    expect(list.map((x) => x.consoleId ?? "global")).toEqual(["global", c.id]);

    // A pack that also carries a console this project doesn't have.
    const foreign = { ...newConsoleTemplate("atari-lynx", "Atari Lynx"), layers: [makeTextLayer("LYNX")] };
    const blob = await buildPack([...list, { consoleId: "atari-lynx", consoleName: "Atari Lynx", project: foreign }]);
    const pack = await readPack(new File([blob], "pack.zip"));
    expect(pack.templates).toHaveLength(3);

    // Change the global template here, then bring the pack's back in.
    await saveProject({ ...g, layers: [] });
    expect(await importPack(pack, pack.templates)).toBe(3);

    const back = await loadProject(GLOBAL_TEMPLATE_ID);
    expect(back?.layers.some((l) => l.name === "g-text")).toBe(true);
    expect(back?.isGlobalTemplate).toBe(true);
    // the replaced version (without the text) was kept as a snapshot
    const snap = (await listSnapshots(GLOBAL_TEMPLATE_ID))[0];
    expect(snap).toBeDefined();
    expect(snap.project.layers.some((l) => l.name === "g-text")).toBe(false);

    const lynx = getCatalog().find((x) => x.name === "Atari Lynx");
    expect(lynx).toBeDefined();
    const lt = await loadProject(templateId(lynx!.id));
    expect(lt?.consoleId).toBe(lynx!.id);
    expect(lt?.isTemplate).toBe(true);
  });

  it("refuses a file that isn't a pack", async () => {
    await expect(readPack(new File(["nope"], "x.zip"))).rejects.toThrow();
  });
});
