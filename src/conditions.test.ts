import { describe, expect, it } from "vitest";
import { caseMatches, conditionFieldsFor, hiddenCaseIds, metaValue, resolveConditions } from "./conditions";
import { makeConditionLayer, makeTextLayer } from "./factory";
import type { GameMeta } from "./gamelist";

const meta: GameMeta = { name: "GT", genre: "Racing, Driving", releasedate: "19980508T000000", rating: "0.8", director: "X" };

describe("conditions", () => {
  it("offers different fields per workspace kind", () => {
    expect(conditionFieldsFor("games")).toContain("developer");
    expect(conditionFieldsFor("games")).not.toContain("director");
    expect(conditionFieldsFor("movies")).toContain("director");
    expect(conditionFieldsFor("movies")).not.toContain("players");
  });

  it("reads formatted metadata values", () => {
    expect(metaValue(meta, "genre")).toBe("Racing, Driving");
    expect(metaValue(meta, "year")).toBe("1998");
    expect(metaValue(meta, "rating")).toBe("4.0");
    expect(metaValue(meta, "director")).toBe("X");
    expect(metaValue(undefined, "genre")).toBe("");
  });

  it("matches a case against any of the listed values", () => {
    expect(caseMatches("Racing", "Racing, Driving")).toBe(true);
    expect(caseMatches("racing / sports", "Driving")).toBe(false);
    expect(caseMatches("Driving; Rally", "Racing, Driving")).toBe(true);
    expect(caseMatches("Racing", "")).toBe(false);
  });

  it("draws the matching case, else Default, and never the switch itself", () => {
    const cond = makeConditionLayer("genre");
    const racing = { ...makeTextLayer("Racing"), condId: cond.id };
    const rpg = { ...makeTextLayer("RPG"), condId: cond.id };
    const dflt = { ...makeTextLayer("Default"), condId: cond.id };
    const plain = makeTextLayer("plain");
    const layers = [plain, cond, racing, rpg, dflt];
    expect(resolveConditions(layers, meta).map((l) => l.name)).toEqual(["plain", "Racing"]);
    expect(resolveConditions(layers, { name: "x", genre: "Puzzle" }).map((l) => l.name)).toEqual(["plain", "Default"]);
    expect(resolveConditions(layers, undefined).map((l) => l.name)).toEqual(["plain", "Default"]);
    expect([...hiddenCaseIds(layers, meta)].sort()).toEqual([rpg.id, dflt.id].sort());
    // A hidden case can be kept for editing.
    expect(resolveConditions(layers, meta, rpg.id).map((l) => l.name)).toContain("RPG");
  });
});
