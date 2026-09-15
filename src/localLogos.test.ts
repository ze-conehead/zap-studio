import { zipSync } from "fflate";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addLocalLogos,
  listLocalLogos,
  logosFromFileList,
  removeAllLocalLogos,
  removeLocalLogo,
  searchLocalLogos,
} from "./localLogos";

// A 1×1 PNG is enough — nothing decodes it here.
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const file = (name: string, type = "image/png") => new File([PNG], name, { type });
const logo = (name: string, path = "") => ({ file: file(name), name, path });

beforeEach(async () => {
  let n = 0;
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: () => `blob:test/${++n}`, revokeObjectURL: () => {} }));
  await removeAllLocalLogos();
});

describe("addLocalLogos", () => {
  it("stores images, skips everything else, and reports it", async () => {
    const r = await addLocalLogos([
      logo("Super Nintendo.png"),
      logo("readme.txt"),
      { file: new File([], "empty.png", { type: "image/png" }), name: "empty.png", path: "" },
    ]);
    expect(r).toEqual({ added: 1, replaced: 0, skipped: 2 });
    expect(listLocalLogos().map((l) => l.name)).toEqual(["Super Nintendo"]);
  });

  it("replaces a file with the same folder and name, keeps a namesake elsewhere", async () => {
    await addLocalLogos([logo("PS.png", "Sony")]);
    const first = listLocalLogos()[0];
    const r = await addLocalLogos([logo("PS.png", "Sony"), logo("PS.png", "Other")]);
    expect(r).toEqual({ added: 1, replaced: 1, skipped: 0 });
    const all = listLocalLogos();
    expect(all.length).toBe(2);
    expect(all.find((l) => l.path === "Sony")?.id).toBe(first.id);
  });

  it("unpacks a zip, nested folders and all, and drops Finder cruft", async () => {
    const bytes = zipSync({
      "Nintendo/Super Nintendo/Super Nintendo.png": PNG,
      "Nintendo/Nintendo 64.png": PNG,
      "Sony/PlayStation.png": PNG,
      "Sony/notes.txt": Uint8Array.from([1]),
      "__MACOSX/Sony/._PlayStation.png": PNG,
      ".DS_Store": PNG,
      "Sony/": new Uint8Array(0),
    });
    const r = await addLocalLogos([
      { file: new Blob([bytes as BlobPart], { type: "application/zip" }), name: "console-logos.zip", path: "" },
    ]);
    expect(r).toEqual({ added: 3, replaced: 0, skipped: 0 });
    expect(listLocalLogos().map((l) => `${l.path}/${l.name}`).sort()).toEqual([
      "console-logos/Nintendo/Nintendo 64",
      "console-logos/Nintendo/Super Nintendo/Super Nintendo",
      "console-logos/Sony/PlayStation",
    ]);
  });

  it("rejects a broken zip with a readable error", async () => {
    await expect(
      addLocalLogos([{ file: new Blob([PNG as BlobPart]), name: "bad.zip", path: "" }]),
    ).rejects.toThrow(/bad\.zip/);
  });

  it("keeps a picked folder's relative paths", () => {
    const f = file("NES.png") as File & { webkitRelativePath: string };
    Object.defineProperty(f, "webkitRelativePath", { value: "logos/Nintendo/NES.png" });
    expect(logosFromFileList([f])).toEqual([{ file: f, name: "NES.png", path: "logos/Nintendo" }]);
  });
});

describe("searchLocalLogos", () => {
  beforeEach(async () => {
    await addLocalLogos([
      logo("Super Nintendo.png", "Nintendo/Super Nintendo"),
      logo("Nintendo 64.png", "Nintendo"),
      logo("nes-logo.png", "Nintendo"),
      logo("PlayStation.png", "Sony"),
      logo("playstation-2.png", "Sony"),
      logo("Neo Geo.png"),
    ]);
  });

  it("puts the exact file name first, then partial matches", async () => {
    expect((await searchLocalLogos("PlayStation")).map((c) => c.title)).toEqual(["PlayStation", "playstation-2"]);
    expect((await searchLocalLogos("Super Nintendo")).map((c) => c.title)[0]).toBe("Super Nintendo");
  });

  it("matches by shared words and ignores case / punctuation", async () => {
    expect((await searchLocalLogos("nintendo 64")).map((c) => c.title)[0]).toBe("Nintendo 64");
    expect((await searchLocalLogos("neo-geo")).map((c) => c.title)).toEqual(["Neo Geo"]);
  });

  it("returns nothing for a console it doesn't have, and blob URLs for those it has", async () => {
    expect(await searchLocalLogos("Sega Saturn")).toEqual([]);
    expect(await searchLocalLogos("")).toEqual([]);
    const [hit] = await searchLocalLogos("Neo Geo");
    expect(hit.url).toMatch(/^blob:/);
    expect(hit.thumb).toBe(hit.url);
  });

  it("forgets removed logos", async () => {
    const neo = listLocalLogos().find((l) => l.name === "Neo Geo")!;
    await removeLocalLogo(neo.id);
    expect(await searchLocalLogos("Neo Geo")).toEqual([]);
    await removeAllLocalLogos();
    expect(listLocalLogos()).toEqual([]);
  });
});
