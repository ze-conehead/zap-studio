import { describe, expect, it } from "vitest";
import {
  makeAlphaMaskLayer,
  makeBackgroundLayer,
  makeImageLayer,
  makeLogoSlotLayer,
  makeShapeLayer,
  makeTextLayer,
  newConsoleTemplate,
  newGlobalTemplate,
  newProject,
} from "./factory";
import { buildFaceLayers, buildOverlay, effectiveBgFill } from "./faceLayers";
import type { CardBackground, ImageLayer, Layer } from "./types";

const img = (name: string, extra: Partial<ImageLayer> = {}): ImageLayer => ({
  ...makeImageLayer({ src: "data:,", naturalWidth: 10, naturalHeight: 10, name }),
  ...extra,
});
const names = (layers: Layer[]) => layers.map((l) => l.name);
const card = () => ({ ...newProject("card"), gameKey: "ps/gt" });

describe("buildFaceLayers", () => {
  it("draws the template stack on top of the card's own free layers", () => {
    const own = [makeTextLayer("own text")];
    const overlay = [img("BildX"), makeTextLayer("frame")];
    const { layers, foreignIds } = buildFaceLayers(card(), own, overlay, []);
    expect(names(layers)).toEqual(["own text", "BildX", "frame"]);
    expect([...foreignIds].length).toBe(2);
    expect(foreignIds.has(own[0].id)).toBe(false);
  });

  it("slots the card's image in where its alpha mask sits — above a lower template image", () => {
    const mask = makeAlphaMaskLayer(1);
    const bildX = img("BildX");
    const cover = img("Cover", { maskId: mask.id });
    const { layers, foreignIds } = buildFaceLayers(card(), [cover], [bildX, mask], [mask]);
    expect(names(layers)).toEqual(["BildX", "Cover", mask.name]);
    const [, clipped, spliced] = layers;
    expect(clipped.clipped).toBe(true);
    expect(spliced.mask).toBe(true);
    expect(spliced.alphaMask).toBe(false);
    expect(spliced.locked).toBe(true);
    expect(foreignIds.has(spliced.id)).toBe(true);
    expect(foreignIds.has(clipped.id)).toBe(false);
  });

  it("keeps the image under a template image that sits above the mask", () => {
    const mask = makeAlphaMaskLayer(1);
    const bildX = img("BildX");
    const cover = img("Cover", { maskId: mask.id });
    const { layers } = buildFaceLayers(card(), [cover], [mask, bildX], [mask]);
    expect(names(layers)).toEqual(["Cover", mask.name, "BildX"]);
  });

  it("never draws a frame nobody fills", () => {
    const mask = makeAlphaMaskLayer(1);
    const { layers } = buildFaceLayers(card(), [], [img("BildX"), mask], [mask]);
    expect(names(layers)).toEqual(["BildX"]);
  });

  it("resolves legacy main / shot links like maskId", () => {
    const m1 = makeAlphaMaskLayer(1);
    const m2 = makeAlphaMaskLayer(2);
    const main = img("Main", { main: true });
    const shot = img("Shot", { shot: 2 });
    const { layers } = buildFaceLayers(card(), [main, shot], [m1, m2], [m1, m2]);
    expect(names(layers)).toEqual(["Main", m1.name, "Shot", m2.name]);
  });

  it("draws an image whose frame is hidden unclipped under the stack", () => {
    const mask = makeAlphaMaskLayer(1);
    const cover = img("Cover", { maskId: mask.id });
    // The mask isn't among the offered ones (hidden) and not in the overlay.
    const { layers } = buildFaceLayers(card(), [cover], [img("BildX")], []);
    expect(names(layers)).toEqual(["Cover", "BildX"]);
    expect(layers[0].clipped).toBeFalsy();
  });

  it("leaves a hidden image out of the frame", () => {
    const mask = makeAlphaMaskLayer(1);
    const cover = img("Cover", { maskId: mask.id, visible: false });
    const { layers } = buildFaceLayers(card(), [cover], [mask], [mask]);
    expect(names(layers)).toEqual(["Cover"]);
    expect(layers[0].clipped).toBeFalsy();
  });

  it("puts several images pointing at one frame into the same clipped run", () => {
    const mask = makeAlphaMaskLayer(1);
    const a = img("A", { maskId: mask.id });
    const b = img("B", { maskId: mask.id });
    const { layers } = buildFaceLayers(card(), [a, b], [mask], [mask]);
    expect(names(layers)).toEqual(["A", "B", mask.name]);
    expect(layers.slice(0, 2).every((l) => l.clipped)).toBe(true);
  });

  it("shows a template its own frames and hides the foreign ones", () => {
    const tpl = newConsoleTemplate("ps", "PlayStation");
    const ownMask = makeAlphaMaskLayer(1);
    const globalMask = makeAlphaMaskLayer(2);
    const { layers, foreignIds } = buildFaceLayers(tpl, [ownMask], [img("G"), globalMask], []);
    expect(names(layers)).toEqual([ownMask.name, "G"]);
    expect(foreignIds.has(ownMask.id)).toBe(false);
  });

  it("does not splice on the global template", () => {
    const g = newGlobalTemplate();
    const mask = makeAlphaMaskLayer(1);
    const { layers } = buildFaceLayers(g, [mask, img("X")], [], [mask]);
    expect(names(layers)).toEqual([mask.name, "X"]);
  });

  it("slots a console template's own logo into the global logo frame's position, still editable", () => {
    const tpl = newConsoleTemplate("ps", "PlayStation");
    const shape = { ...makeShapeLayer("rect"), name: "Shape" };
    const slot = makeLogoSlotLayer(); // above the shape in the global stack
    const logo = img("Logo", { logo: true });
    const { layers, foreignIds } = buildFaceLayers(tpl, [logo], [shape, slot], []);
    expect(names(layers)).toEqual(["Shape", "Logo"]);
    expect(foreignIds.has(logo.id)).toBe(false);
  });

  it("never draws the logo frame itself, template edit or not", () => {
    const tpl = newConsoleTemplate("ps", "PlayStation");
    const slot = makeLogoSlotLayer();
    const { layers } = buildFaceLayers(tpl, [], [img("BildX"), slot], []);
    expect(names(layers)).toEqual(["BildX"]);
  });
});

describe("buildOverlay", () => {
  it("slots the console's logo into the global logo frame's own stacking position", () => {
    const shape = { ...makeShapeLayer("rect"), name: "Shape" };
    const slot = makeLogoSlotLayer(); // above the shape — logos should draw on top of it
    const globalP = { ...newGlobalTemplate(), layers: [shape, slot] };
    const logo = img("Logo", { logo: true });
    const consoleP = { ...newConsoleTemplate("ps", "PlayStation"), layers: [logo] };

    const layers = buildOverlay(consoleP, undefined, globalP, undefined);
    expect(names(layers)).toEqual(["Shape", "Logo"]);
  });

  it("still draws the shape when there is no logo yet, and never draws the frame itself", () => {
    const shape = { ...makeShapeLayer("rect"), name: "Shape" };
    const globalP = { ...newGlobalTemplate(), layers: [shape, makeLogoSlotLayer()] };
    const consoleP = newConsoleTemplate("ps", "PlayStation");

    const layers = buildOverlay(consoleP, undefined, globalP, undefined);
    expect(names(layers)).toEqual(["Shape"]);
  });

  it("keeps every other console layer below the whole global stack", () => {
    const banner = img("Banner");
    const consoleP = { ...newConsoleTemplate("ps", "PlayStation"), layers: [banner] };
    const shape = { ...makeShapeLayer("rect"), name: "Shape" };
    const globalP = { ...newGlobalTemplate(), layers: [shape] };

    const layers = buildOverlay(consoleP, undefined, globalP, undefined);
    expect(names(layers)).toEqual(["Banner", "Shape"]);
  });
});

const fill = (color: string): CardBackground => ({
  kind: "solid",
  color,
  color2: color,
  angle: 90,
  noise: 0,
});

describe("effectiveBgFill — card → console → global", () => {
  const consoleBg = fill("#c0");
  const globalBg = fill("#g0");

  it("a card with no background layer takes the console's, else the global one", () => {
    expect(effectiveBgFill(undefined, { inherit: true, consoleBg, globalBg })).toBe(consoleBg);
    expect(effectiveBgFill(undefined, { inherit: true, globalBg })).toBe(globalBg);
    expect(effectiveBgFill(undefined, { inherit: true })).toBeNull();
  });

  it("an own background wins over both templates", () => {
    const own = makeBackgroundLayer(fill("#own"), "card");
    expect(effectiveBgFill(own, { inherit: true, consoleBg, globalBg })).toBe(own.fill);
  });

  it("a layer set to inherit follows the chain, whichever template it once named", () => {
    for (const source of ["console", "global"] as const) {
      const bg = makeBackgroundLayer(fill("#x"), source);
      expect(effectiveBgFill(bg, { inherit: true, consoleBg, globalBg })).toBe(consoleBg);
      expect(effectiveBgFill(bg, { inherit: true, globalBg })).toBe(globalBg);
    }
  });

  it("a hidden background paints nothing", () => {
    const bg = { ...makeBackgroundLayer(fill("#x"), "card"), visible: false };
    expect(effectiveBgFill(bg, { inherit: true, consoleBg, globalBg })).toBeNull();
  });

  it("templates and the back face only ever use their own layer or the fallback", () => {
    const bg = makeBackgroundLayer(fill("#tpl"), "global");
    expect(effectiveBgFill(bg, { inherit: false, consoleBg, globalBg })).toBe(bg.fill);
    expect(effectiveBgFill(undefined, { inherit: false, fallback: globalBg, consoleBg })).toBe(globalBg);
    expect(effectiveBgFill(undefined, { inherit: false, consoleBg })).toBeNull();
  });
});
