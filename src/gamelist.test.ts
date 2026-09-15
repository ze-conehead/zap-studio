import { describe, expect, it } from "vitest";
import {
  findMeta,
  formatReleaseDate,
  fromDateInputValue,
  loadGamelist,
  parseGamelistXml,
  ratingOutOfFive,
  releaseYear,
  removeGameMeta,
  renameGameMeta,
  toDateInputValue,
  upsertGameMeta,
} from "./gamelist";

const XML = `<?xml version="1.0"?>
<gameList>
  <game>
    <path>./tekken3.chd</path>
    <name>Tekken 3</name>
    <desc>Fighting.</desc>
    <releasedate>19980327T000000</releasedate>
    <developer>Namco</developer>
    <genre>Fighting</genre>
    <players>1-2</players>
    <rating>0.9</rating>
  </game>
  <game><name></name></game>
  <game><name>Gran Turismo</name></game>
</gameList>`;

describe("parseGamelistXml", () => {
  it("reads the EmulationStation fields and drops nameless entries", () => {
    const games = parseGamelistXml(XML);
    expect(games.map((g) => g.name)).toEqual(["Tekken 3", "Gran Turismo"]);
    expect(games[0]).toMatchObject({
      path: "./tekken3.chd",
      desc: "Fighting.",
      releasedate: "19980327T000000",
      developer: "Namco",
      genre: "Fighting",
      players: "1-2",
      rating: "0.9",
    });
    expect(games[0].publisher).toBeUndefined();
  });

  it("rejects broken XML and lists without games", () => {
    expect(() => parseGamelistXml("<gameList><game>")).toThrow();
    expect(() => parseGamelistXml("<gameList></gameList>")).toThrow();
  });
});

describe("entries per console", () => {
  it("upserts by title, case-insensitively, and merges fields", () => {
    upsertGameMeta("ps", "Tekken 3", { genre: "Fighting" });
    upsertGameMeta("ps", "tekken 3 ", { players: "1-2" });
    const list = loadGamelist("ps");
    expect(list.length).toBe(1);
    expect(findMeta(list, "TEKKEN 3")).toMatchObject({ genre: "Fighting", players: "1-2" });
    expect(loadGamelist("n64")).toEqual([]);
  });

  it("renames and removes", () => {
    upsertGameMeta("ps", "Old", { genre: "x" });
    renameGameMeta("ps", "Old", "New");
    expect(findMeta(loadGamelist("ps"), "New")?.genre).toBe("x");
    expect(findMeta(loadGamelist("ps"), "Old")).toBeUndefined();
    removeGameMeta("ps", "New");
    expect(loadGamelist("ps")).toEqual([]);
  });
});

describe("formatting helpers", () => {
  it("dates round-trip between the gamelist stamp and <input type=date>", () => {
    expect(toDateInputValue("19980327T000000")).toBe("1998-03-27");
    expect(fromDateInputValue("1998-03-27")).toBe("19980327T000000");
    expect(fromDateInputValue("")).toBeUndefined();
    expect(releaseYear("19980327T000000")).toBe("1998");
    expect(releaseYear(undefined)).toBeUndefined();
    expect(formatReleaseDate("19980327T000000")).toMatch(/1998/);
  });

  it("ratings scale 0..1 to five stars", () => {
    expect(ratingOutOfFive("0.921")).toBe("4.6");
    expect(ratingOutOfFive("1")).toBe("5.0");
    expect(ratingOutOfFive("abc")).toBeUndefined();
    expect(ratingOutOfFive(undefined)).toBeUndefined();
  });
});
