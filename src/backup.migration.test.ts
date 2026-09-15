import { strToU8, zipSync } from "fflate";
import { beforeEach, describe, expect, it } from "vitest";
import { importBackup } from "./backup";
import { buildFaceLayers } from "./faceLayers";
import { alphaMasksOf, resolveMask } from "./templates";
import { deleteProject, loadAllProjects, loadProject } from "./persist";
import { loadGuides } from "./guides";
import type { ImageLayer, Project } from "./types";

// A backup the way v1.0.0 wrote it: projects still carry the legacy
// `background` / `backgroundColor` fields instead of a background layer,
// the global template's frame is a `mainMask` shape, the card's cover is
// linked by `main: true` (no maskId), screenshots by `shot: n`, images
// point at assets/… files, and there is a single settings/gameIndex.json.
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);

const layerBase = (id: string, name: string) => ({
  id,
  name,
  x: 354.5,
  y: 541,
  rotation: 0,
  scaleX: 1,
  scaleY: 1,
  opacity: 1,
  visible: true,
  locked: false,
});

const v1Global = {
  id: "tpl-global",
  name: "All consoles",
  layers: [
    {
      ...layerBase("frame", "Main alpha mask"),
      type: "shape",
      shape: "rect",
      width: 400,
      height: 300,
      cornerRadius: 12,
      fill: { kind: "solid", color: "#38bdf8", color2: "#6366f1", angle: 90, noise: 0 },
      stroke: "#000000",
      strokeWidth: 0,
      mainMask: true,
    },
    {
      ...layerBase("shot-frame", "Screenshot frame"),
      type: "shape",
      shape: "rect",
      width: 300,
      height: 200,
      y: 900,
      cornerRadius: 0,
      fill: { kind: "solid", color: "#38bdf8", color2: "#6366f1", angle: 90, noise: 0 },
      stroke: "#000000",
      strokeWidth: 0,
      shotMask: 1,
    },
  ],
  background: { kind: "solid", color: "#101010", color2: "#000000", angle: 90, noise: 0 },
  createdAt: 1,
  updatedAt: 1,
  isTemplate: true,
  isGlobalTemplate: true,
};

const v1Card = {
  id: "card-1",
  name: "Gran Turismo",
  gameKey: "playstation/gran-turismo",
  consoleName: "PlayStation",
  backgroundColor: "transparent",
  backgroundSource: "global",
  layers: [
    {
      ...layerBase("cover", "Main image"),
      type: "image",
      src: "asset:cover.png",
      naturalWidth: 10,
      naturalHeight: 10,
      width: 400,
      height: 400,
      cornerRadius: 0,
      main: true,
    },
    {
      ...layerBase("shot", "Screenshot 1"),
      type: "image",
      src: "asset:cover.png",
      naturalWidth: 10,
      naturalHeight: 10,
      width: 300,
      height: 200,
      cornerRadius: 0,
      shot: 1,
    },
    { ...layerBase("title", "Title"), type: "text", text: "Gran Turismo", fontFamily: "Oswald", fontSize: 48, bold: true, italic: false, fill: "#fff", align: "center", lineHeight: 1.1, letterSpacing: 0, stroke: "#000", strokeWidth: 0, width: 500 },
  ],
  createdAt: 1,
  updatedAt: 2,
};

function v1Backup(): File {
  const files = {
    "manifest.json": strToU8(JSON.stringify({ format: "credit-card-sticker-studio-backup", version: 1, assets: { "cover.png": "image/png" } })),
    "templates/tpl-global.json": strToU8(JSON.stringify(v1Global)),
    "projects/card-1.json": strToU8(JSON.stringify(v1Card)),
    "assets/cover.png": PNG,
    "settings/guides.json": strToU8(JSON.stringify({ on: true, locked: false, snap: true, items: [{ id: "g", axis: "x", pos: 100 }] })),
    "settings/gameIndex.json": strToU8(JSON.stringify({ "playstation/gran-turismo": "card-1" })),
  };
  return new File([zipSync(files) as BlobPart], "v1.zip");
}

beforeEach(async () => {
  for (const p of await loadAllProjects()) await deleteProject(p.id);
});

describe("a v1.0.0 backup still loads", () => {
  it("imports both projects and restores the settings", async () => {
    const r = await importBackup(v1Backup());
    expect(r).toEqual({ projects: 1, templates: 1 });
    expect(loadGuides().items[0].pos).toBe(100);
    expect(JSON.parse(localStorage.getItem("stickerstudio:gameIndex") ?? "{}")["playstation/gran-turismo"]).toBe("card-1");
  });

  it("migrates the legacy fields on load", async () => {
    await importBackup(v1Backup());
    const g = (await loadProject("tpl-global"))!;
    const card = (await loadProject("card-1"))!;

    // Legacy background → a background layer at the bottom; mainMask /
    // shotMask → alphaMask; the image src is a data URL again.
    expect(g.layers[0].type).toBe("background");
    expect((g.layers[0] as { fill: { color: string } }).fill.color).toBe("#101010");
    expect(alphaMasksOf(g).map((l) => l.id)).toEqual(["frame", "shot-frame"]);
    // Every frame is an alpha mask now; the legacy numbers stay for the links.
    expect(alphaMasksOf(g).every((l) => l.alphaMask)).toBe(true);
    expect(alphaMasksOf(g)[1].shotMask).toBe(1);

    const cover = card.layers.find((l) => l.id === "cover") as ImageLayer;
    expect(cover.src.startsWith("data:image/png;base64,")).toBe(true);
    // A transparent legacy background adds no layer.
    expect(card.layers.some((l) => l.type === "background")).toBe(false);

    // `main` / `shot` still find their frames …
    const masks = alphaMasksOf(g);
    expect(resolveMask(cover, masks)?.id).toBe("frame");
    expect(resolveMask(card.layers.find((l) => l.id === "shot")!, masks)?.id).toBe("shot-frame");
    // … and the face renders each image clipped at its frame's position.
    const { layers } = buildFaceLayers(card as Project, card.layers, g.layers.slice(1), masks);
    expect(layers.map((l) => l.name)).toEqual(["Title", "Main image", "Main alpha mask", "Screenshot 1", "Screenshot frame"]);
    expect(layers[1].clipped && layers[2].mask).toBe(true);
  });
});

describe("legacy links on a template migrated before the numbers were kept", () => {
  it("counts the main frame first, then the screenshot frames", () => {
    const frame = (id: string) => ({ id, type: "shape", alphaMask: true } as unknown as import("./types").Layer);
    const masks = [frame("main"), frame("s1"), frame("s2")];
    const img = (extra: object) => ({ type: "image", ...extra }) as unknown as import("./types").Layer;
    expect(resolveMask(img({ main: true }), masks)?.id).toBe("main");
    expect(resolveMask(img({ shot: 1 }), masks)?.id).toBe("s1");
    expect(resolveMask(img({ shot: 2 }), masks)?.id).toBe("s2");
    // Only one frame at all: the shot falls back to it.
    expect(resolveMask(img({ shot: 1 }), [frame("only")])?.id).toBe("only");
  });
});
