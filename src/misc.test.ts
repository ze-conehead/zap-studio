import { describe, expect, it } from "vitest";
import { addConsole, addGame, getCatalog, reorderConsoles, reorderGames, removeConsole } from "./data/catalog";
import { customCardFormat, getFormat, getFormatId, setBleedOverride } from "./formats";
import { parseLocaleNumber } from "./lib/utils";
import { compareVersions } from "./updateCheck";

describe("compareVersions", () => {
  it("orders semver-ish strings numerically, ignoring a v prefix", () => {
    expect(compareVersions("v1.2.0", "1.2.0")).toBe(0);
    expect(compareVersions("1.10.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.2", "1.2.1")).toBeLessThan(0);
    expect(compareVersions("2.0.0", "10.0.0")).toBeLessThan(0);
  });
});

describe("parseLocaleNumber", () => {
  it("accepts a comma or a period", () => {
    expect(parseLocaleNumber("3,5")).toBe(3.5);
    expect(parseLocaleNumber(" 3.5 ")).toBe(3.5);
    expect(parseLocaleNumber("x")).toBeUndefined();
    expect(parseLocaleNumber("")).toBe(0);
  });
});

describe("formats", () => {
  it("defaults to the card and takes a bleed override", () => {
    expect(getFormatId()).toBe("card");
    expect(getFormat().bleedMM).toBe(3);
    setBleedOverride(1.5);
    expect(getFormat().bleedMM).toBe(1.5);
    setBleedOverride(undefined);
    expect(getFormat().bleedMM).toBe(3);
  });

  it("builds a custom format from a spec", () => {
    const f = customCardFormat({ wMM: 60, hMM: 90, cornerRadiusMM: 2 });
    expect(f).toMatchObject({ id: "custom", trimMM: { w: 60, h: 90 }, cornerRadiusMM: 2 });
  });
});

describe("catalog order", () => {
  it("keeps added consoles and games in the order given", () => {
    const a = addConsole("Zeta")!;
    const b = addConsole("Alpha")!;
    const ids = () => getCatalog().map((c) => c.id);
    expect(ids().indexOf(a.id)).toBeLessThan(ids().indexOf(b.id));
    reorderConsoles([...ids().filter((id) => id !== b.id && id !== a.id), b.id, a.id]);
    expect(ids().indexOf(b.id)).toBeLessThan(ids().indexOf(a.id));

    const g1 = addGame(a.id, "One")!;
    const g2 = addGame(a.id, "Two")!;
    reorderGames(a.id, [g2.id, g1.id]);
    expect(getCatalog().find((c) => c.id === a.id)!.games.map((g) => g.title)).toEqual(["Two", "One"]);

    removeConsole(a.id);
    removeConsole(b.id);
    expect(ids()).not.toContain(a.id);
  });

  it("returns the existing entry instead of a duplicate", () => {
    const c = addConsole("Dup")!;
    expect(addConsole("dup")?.id).toBe(c.id);
    const g = addGame(c.id, "Game")!;
    expect(addGame(c.id, "game")?.id).toBe(g.id);
    expect(getCatalog().find((x) => x.id === c.id)!.games.length).toBe(1);
    expect(addGame(c.id, "  ")).toBeUndefined();
    removeConsole(c.id);
  });
});
