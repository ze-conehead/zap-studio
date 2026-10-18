import { beforeEach, describe, expect, it } from "vitest";
import { isPrinted, lastExportKeys, printedKeys, rememberExport, setPrinted } from "./printed";

describe("printed cards", () => {
  beforeEach(() => localStorage.clear());

  it("marks and unmarks cards", () => {
    expect(isPrinted("nes/a")).toBe(false);
    setPrinted(["nes/a", "nes/b"], true);
    expect(isPrinted("nes/a")).toBe(true);
    expect([...printedKeys()].sort()).toEqual(["nes/a", "nes/b"]);
    setPrinted(["nes/a"], false);
    expect([...printedKeys()]).toEqual(["nes/b"]);
  });

  it("remembers what the last export covered", () => {
    expect(lastExportKeys()).toEqual([]);
    rememberExport(["snes/x", "snes/y"]);
    expect(lastExportKeys()).toEqual(["snes/x", "snes/y"]);
    rememberExport(["nes/a"]);
    expect(lastExportKeys()).toEqual(["nes/a"]);
  });

  it("ignores a damaged value", () => {
    localStorage.setItem("stickerstudio:printed", "{not json");
    expect(printedKeys().size).toBe(0);
    localStorage.setItem("stickerstudio:printed", JSON.stringify([1, "ok"]));
    expect([...printedKeys()]).toEqual(["ok"]);
  });
});
