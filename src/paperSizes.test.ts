import { describe, expect, it } from "vitest";
import { deleteSize, loadSavedSizes, sameSettings, savedMatch, saveSize, updateSizeSettings, type PaperSettings } from "./paperSizes";

describe("saved paper sizes", () => {
  it("starts empty, keeps what is saved and survives a reload of the list", () => {
    expect(loadSavedSizes()).toEqual([]);
    saveSize("Photo printer", 330, 483);
    saveSize("Label sheet", 100, 150);
    expect(loadSavedSizes().map((s) => s.name)).toEqual(["Photo printer", "Label sheet"]);
  });

  it("stores the short side first, whichever way round it was typed", () => {
    const [s] = saveSize("Wide", 483, 330);
    expect([s.wMM, s.hMM]).toEqual([330, 483]);
  });

  it("saving under an existing name replaces it instead of duplicating", () => {
    const first = saveSize("Mine", 200, 300)[0];
    const list = saveSize("mine", 210, 310);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: first.id, name: "mine", wMM: 210, hMM: 310 });
  });

  it("names an unnamed size by its dimensions", () => {
    expect(saveSize("  ", 123.4, 456)[0].name).toBe("123.4 × 456 mm");
  });

  it("matches a size either way round, and deletes by id", () => {
    saveSize("B", 100, 200);
    const list = saveSize("A", 150, 250);
    const a = list.find((x) => x.name === "A")!;
    const b = list.find((x) => x.name === "B")!;
    expect(savedMatch(list, { wMM: 250, hMM: 150 })?.id).toBe(a.id);
    expect(savedMatch(list, { wMM: 1, hMM: 2 })).toBeUndefined();

    const after = deleteSize(a.id);
    expect(after.map((x) => x.id)).toEqual([b.id]);
    expect(loadSavedSizes().map((x) => x.id)).toEqual([b.id]);
    expect(savedMatch(after, { wMM: 150, hMM: 250 })).toBeUndefined();
  });

  it("ignores damaged storage", () => {
    localStorage.setItem("stickerstudio:savedPaperSizes", "{not json");
    expect(loadSavedSizes()).toEqual([]);
    localStorage.setItem("stickerstudio:savedPaperSizes", JSON.stringify([{ id: 1 }, null, "x"]));
    expect(loadSavedSizes()).toEqual([]);
  });
});

describe("sheet settings saved with a size", () => {
  const mine: PaperSettings = { gapMM: 2, marginMM: 8, whiteBackground: true, cropMarks: true };

  it("keeps the gap, margin, white background and crop marks with the size", () => {
    const [s] = saveSize("Photo printer", 330, 483, mine);
    expect(s.settings).toEqual(mine);
    expect(loadSavedSizes()[0].settings).toEqual(mine);
  });

  it("saving again under the name replaces the settings too", () => {
    saveSize("Photo printer", 330, 483, mine);
    const [s] = saveSize("photo printer", 330, 483, { ...mine, gapMM: 5, cropMarks: false });
    expect(s.settings).toEqual({ ...mine, gapMM: 5, cropMarks: false });
  });

  it("updates just the settings of one size", () => {
    const list = saveSize("A", 100, 200, mine);
    const after = updateSizeSettings(list[0].id, { ...mine, marginMM: 0 });
    expect(after[0]).toMatchObject({ name: "A", wMM: 100, hMM: 200, settings: { marginMM: 0, gapMM: 2 } });
  });

  it("a size saved before settings were kept has none, and loads as it was", () => {
    localStorage.setItem(
      "stickerstudio:savedPaperSizes",
      JSON.stringify([{ id: "x", name: "Old", wMM: 100, hMM: 200 }]),
    );
    expect(loadSavedSizes()[0].settings).toBeUndefined();
    expect(loadSavedSizes()).toHaveLength(1);
  });

  it("a damaged settings block is dropped but the size survives", () => {
    localStorage.setItem(
      "stickerstudio:savedPaperSizes",
      JSON.stringify([{ id: "x", name: "Odd", wMM: 100, hMM: 200, settings: { gapMM: "wide" } }]),
    );
    const [s] = loadSavedSizes();
    expect(s.name).toBe("Odd");
    expect(s.settings).toBeUndefined();
  });

  it("compares settings with a hair of tolerance on the millimetres", () => {
    expect(sameSettings(mine, { ...mine, gapMM: 2.001 })).toBe(true);
    expect(sameSettings(mine, { ...mine, gapMM: 2.5 })).toBe(false);
    expect(sameSettings(mine, { ...mine, whiteBackground: false })).toBe(false);
    expect(sameSettings(mine, { ...mine, cropMarks: false })).toBe(false);
  });
});
