import { beforeEach, describe, expect, it } from "vitest";
import { findMeta, loadGamelist } from "./gamelist";
import {
  addCustomColumn,
  allColumns,
  cellPatch,
  cellValue,
  columnKeyFor,
  hiddenColumns,
  loadCustomColumns,
  placeholderOptions,
  removeCustomColumn,
  setColumnHidden,
  writeCell,
  type MetaColumn,
} from "./metaColumns";
import { resolvePlaceholders } from "./placeholders";

const col = (key: string, kind: MetaColumn["kind"] = "text", custom = false): MetaColumn => ({
  key,
  label: key,
  kind,
  custom,
});

beforeEach(() => localStorage.clear());

describe("metadata columns", () => {
  it("own column keys are letters only, unique and never a built-in placeholder", () => {
    expect(columnKeyFor("Edition (EU)", [])).toBe("editioneu");
    expect(columnKeyFor("Größe", [])).toBe("grosse");
    expect(columnKeyFor("Edition", ["edition"])).toBe("editionb");
    expect(columnKeyFor("Genre", [])).toBe("genreb"); // {genre} is taken
    expect(columnKeyFor("123", [])).toBe("field");
  });

  it("adds, lists and removes an own column together with its values", () => {
    const c = addCustomColumn("Region")!;
    expect(loadCustomColumns()).toEqual([{ key: "region", label: "Region" }]);
    expect(allColumns("games").at(-1)).toMatchObject({ key: "region", custom: true });
    writeCell("psx", "Tekken 3", { ...c, kind: "text", custom: true }, "PAL");
    expect(findMeta(loadGamelist("psx"), "Tekken 3")?.custom).toEqual({ region: "PAL" });
    removeCustomColumn("region", ["psx"]);
    expect(loadCustomColumns()).toEqual([]);
    expect(findMeta(loadGamelist("psx"), "Tekken 3")?.custom).toBeUndefined();
  });

  it("hides the long fields until the user picks, then remembers the choice", () => {
    expect(hiddenColumns().has("desc")).toBe(true);
    expect(hiddenColumns().has("genre")).toBe(false);
    setColumnHidden("genre", true);
    setColumnHidden("desc", false);
    expect(hiddenColumns().has("genre")).toBe(true);
    expect(hiddenColumns().has("desc")).toBe(false);
  });

  it("shows dates as YYYY-MM-DD and ratings out of 5, and stores them back", () => {
    const meta = { name: "x", releasedate: "19980326T000000", rating: "0.9" };
    expect(cellValue(meta, col("releasedate", "date"))).toBe("1998-03-26");
    expect(cellValue(meta, col("rating", "rating"))).toBe("4.5");
    expect(cellPatch(meta, col("releasedate", "date"), "2001-12-24")).toEqual({ releasedate: "20011224T000000" });
    expect(cellPatch(meta, col("rating", "rating"), "4,5")).toEqual({ rating: "0.900" });
    expect(cellPatch(meta, col("rating", "rating"), "")).toEqual({ rating: undefined });
    expect(cellPatch(meta, col("genre"), "  ")).toEqual({ genre: undefined });
  });

  it("writing a cell creates the game's entry when it has none", () => {
    writeCell("n64", "Mario Kart 64", col("genre"), "Racing");
    expect(loadGamelist("n64")).toEqual([{ name: "Mario Kart 64", genre: "Racing" }]);
  });

  it("an own column prints through its {key} placeholder", () => {
    const meta = { name: "x", custom: { region: "PAL" } };
    expect(resolvePlaceholders("Region: {region}", { meta })).toBe("Region: PAL");
    expect(resolvePlaceholders("{constructor}", { meta })).toBe("{constructor}");
  });

  it("the placeholder pickers list the own columns after the built-in ones", () => {
    addCustomColumn("Region");
    const opts = placeholderOptions("games");
    expect(opts[0]).toMatchObject({ key: "title" });
    expect(opts.at(-1)).toEqual({ key: "region", label: "Region", custom: true });
    expect(opts.filter((o) => o.custom)).toHaveLength(1);
  });
});
