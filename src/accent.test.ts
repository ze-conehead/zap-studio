import { describe, expect, it } from "vitest";
import { ACCENT_TOKEN, accentSource, applyAccent, cardAccent, DEFAULT_ACCENT } from "./accent";
import { makeAlphaMaskLayer, makeImageLayer, makeShapeLayer, newProject } from "./factory";
import type { ImageLayer } from "./types";

const img = (name: string, over: Partial<ImageLayer> = {}): ImageLayer => ({
  ...makeImageLayer({ src: `data:${name}`, naturalWidth: 100, naturalHeight: 100, name }),
  ...over,
});

describe("applyAccent", () => {
  it("swaps the token anywhere, deep, and leaves untouched objects alone", () => {
    const shape = makeShapeLayer("rect");
    const painted = {
      ...shape,
      stroke: ACCENT_TOKEN,
      fill: { ...shape.fill, kind: "gradient" as const, stops: ["#000000", ACCENT_TOKEN] },
    };
    const out = applyAccent(painted, "#ff0000");
    expect(out.stroke).toBe("#ff0000");
    expect(out.fill.stops).toEqual(["#000000", "#ff0000"]);
    expect(painted.stroke).toBe(ACCENT_TOKEN); // not mutated
    expect(applyAccent(shape, "#ff0000")).toBe(shape); // same identity
  });

  it("never touches image data", () => {
    const l = img("x", { src: ACCENT_TOKEN });
    expect(applyAccent(l, "#ff0000").src).toBe(ACCENT_TOKEN);
  });
});

describe("accentSource / cardAccent", () => {
  it("prefers the cover frame's picture, skipping logos and spine backgrounds", () => {
    const cover = makeAlphaMaskLayer(1);
    const shot = { ...makeAlphaMaskLayer(2), shotOnly: true };
    const p = newProject("g");
    p.layers = [
      img("logo", { logo: true, width: 900, height: 900 }),
      img("spine", { spineBg: true, width: 900, height: 900 }),
      img("shot", { maskId: shot.id }),
      img("cover", { maskId: cover.id }),
    ];
    expect(accentSource(p, [cover, shot])?.name).toBe("cover");
    expect(accentSource(p, [shot])?.name).toBe("shot");
    // all screenshot frames: the first frame's picture, whatever the layer order
    const shot2 = { ...makeAlphaMaskLayer(3), shotOnly: true };
    p.layers = [img("second", { maskId: shot2.id }), img("first", { maskId: shot.id })];
    expect(accentSource(p, [shot, shot2])?.name).toBe("first");
  });

  it("a fixed accent wins; nothing loaded falls back to the default", () => {
    const p = newProject("g");
    p.layers = [img("a")];
    expect(cardAccent(p)).toBe(DEFAULT_ACCENT);
    expect(cardAccent({ ...p, accent: "#123456" })).toBe("#123456");
  });
});
