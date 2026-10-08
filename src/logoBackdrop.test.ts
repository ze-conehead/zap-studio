import { describe, expect, it } from "vitest";
import { makeBackgroundLayer, newConsoleTemplate, newGlobalTemplate } from "./factory";
import {
  DARK_LOGO,
  fillToCss,
  getLogoBgMode,
  LIGHT_LOGO,
  lightnessOf,
  loadCardBackdrop,
  setLogoBgMode,
  tileBackground,
  tileForLightness,
} from "./logoBackdrop";
import { saveProject } from "./persist";
import type { CardBackground } from "./types";

const solid = (color: string): CardBackground => ({ kind: "solid", color, color2: color, angle: 0, noise: 0 });

describe("fillToCss", () => {
  it("paints solid, linear and radial fills; nothing for a transparent one", () => {
    expect(fillToCss(solid("#112233"))).toBe("#112233");
    expect(fillToCss({ ...solid("#000"), kind: "gradient", stops: ["#111", "#eee"], angle: 90 })).toBe(
      "linear-gradient(180deg, #111, #eee)", // the app's 90° is "down", CSS's 180°
    );
    expect(fillToCss({ ...solid("#000"), kind: "gradient", stops: ["#111", "#eee"], gradientKind: "radial", angle: 0 })).toBe(
      "radial-gradient(circle, #111, #eee)",
    );
    expect(fillToCss({ ...solid("#000"), kind: "none" })).toBeNull();
    expect(fillToCss(undefined)).toBeNull();
  });

  it("swaps a token that has no colour yet for the default accent", () => {
    expect(fillToCss(solid("{accent}"))).toBe("#64748b");
    expect(fillToCss({ ...solid("#000"), kind: "gradient", stops: ["#111", "{contrast}"], angle: 0 })).toBe(
      "linear-gradient(90deg, #111, #64748b)",
    );
  });
});

describe("loadCardBackdrop", () => {
  const withBg = (p: ReturnType<typeof newGlobalTemplate>, fill: CardBackground | null, visible = true) => ({
    ...p,
    layers: fill ? [{ ...makeBackgroundLayer(), fill, visible }] : [],
  });

  it("is the console template's background, else the global one's", async () => {
    await saveProject(withBg(newGlobalTemplate(), solid("#aa0000")));
    expect(await loadCardBackdrop()).toBe("#aa0000");
    expect(await loadCardBackdrop("ps")).toBe("#aa0000"); // a console with no template of its own

    await saveProject(withBg(newConsoleTemplate("ps", "PlayStation"), solid("#00aa00")));
    expect(await loadCardBackdrop("ps")).toBe("#00aa00");
    expect(await loadCardBackdrop("n64")).toBe("#aa0000");
  });

  it("applies the console's override of the global background", async () => {
    const global = withBg(newGlobalTemplate(), solid("#aa0000"));
    await saveProject(global);
    const bgId = global.layers[0].id;
    await saveProject({
      ...newConsoleTemplate("ps", "PlayStation"),
      fillOverrides: { [bgId]: { fill: solid("#0000aa") } },
    });
    expect(await loadCardBackdrop("ps")).toBe("#0000aa");
  });

  it("is null when no visible background exists", async () => {
    await saveProject(withBg(newGlobalTemplate(), solid("#aa0000"), false));
    expect(await loadCardBackdrop("ps")).toBeNull();
  });
});

describe("a logo's own lightness", () => {
  const px = (r: number, g: number, b: number, a = 255) => [r, g, b, a];

  it("averages the visible pixels, weighted by opacity", () => {
    expect(lightnessOf(new Uint8ClampedArray([...px(0, 0, 0), ...px(0, 0, 0)]))).toBeCloseTo(0);
    expect(lightnessOf(new Uint8ClampedArray([...px(255, 255, 255), ...px(255, 255, 255)]))).toBeCloseTo(1);
    // transparent padding doesn't count: a white logo on nothing is still white
    expect(lightnessOf(new Uint8ClampedArray([...px(255, 255, 255), ...px(0, 0, 0, 0), ...px(0, 0, 0, 0)]))).toBeCloseTo(1);
    expect(lightnessOf(new Uint8ClampedArray([...px(0, 0, 0, 0)]))).toBeNull();
  });

  it("picks a light tile for a dark logo, a dark one for a light logo, the checkerboard in between", () => {
    expect(tileForLightness(0)).toBe("#e5e7eb");
    expect(tileForLightness(DARK_LOGO)).toBe("#e5e7eb");
    expect(tileForLightness(0.5)).toBeNull();
    expect(tileForLightness(LIGHT_LOGO)).toBe("#1f2937");
    expect(tileForLightness(1)).toBe("#1f2937");
    expect(tileForLightness(null)).toBeNull();
  });
});

describe("the chosen tile background", () => {
  it("forces black, white or the checkerboard, whatever the card or the logo look like", () => {
    for (const backdrop of ["#123456", null, undefined]) {
      expect(tileBackground("black", backdrop, 0.9)).toBe("#000000");
      expect(tileBackground("white", backdrop, 0.1)).toBe("#ffffff");
      expect(tileBackground("transparent", backdrop, 0.1)).toBeNull();
    }
  });

  it("card mode: the card's background, else light / dark by the logo", () => {
    expect(tileBackground("card", "#123456", 0.9)).toBe("#123456");
    expect(tileBackground("card", null, 0.1)).toBe("#e5e7eb");
    expect(tileBackground("card", null, 0.9)).toBe("#1f2937");
    expect(tileBackground("card", null, 0.5)).toBeNull();
    // still loading the card's background: no guess yet beyond the logo
    expect(tileBackground("card", undefined, null)).toBeNull();
  });

  it("is remembered, and falls back to the card mode for junk", () => {
    expect(getLogoBgMode()).toBe("card");
    setLogoBgMode("white");
    expect(getLogoBgMode()).toBe("white");
    setLogoBgMode("card");
    expect(localStorage.getItem("stickerstudio:logoTileBg")).toBeNull();
    localStorage.setItem("stickerstudio:logoTileBg", "purple");
    expect(getLogoBgMode()).toBe("card");
  });
});
