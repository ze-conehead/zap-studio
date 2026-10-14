import { describe, expect, it } from "vitest";
import { bakeScale, makeImageLayer, makeQrLayer, migrateProject, newProject } from "./factory";
import type { ImageLayer } from "./types";

const img = (over: Partial<ImageLayer> = {}): ImageLayer => ({
  ...makeImageLayer({ src: "x", naturalWidth: 400, naturalHeight: 200, name: "i" }),
  width: 200,
  height: 100,
  ...over,
});

describe("bakeScale", () => {
  it("folds a resize kept as a scale into width and height", () => {
    const b = bakeScale(img({ scaleX: 0.5, scaleY: 0.25 }));
    expect(b).toMatchObject({ width: 100, height: 25, scaleX: 1, scaleY: 1 });
  });

  it("keeps a mirror as -1 and bakes the size", () => {
    const b = bakeScale(img({ scaleX: -2, scaleY: 1 }));
    expect(b).toMatchObject({ width: 400, height: 100, scaleX: -1, scaleY: 1 });
  });

  it("covers QR codes too, and leaves everything unscaled alone", () => {
    const q = { ...makeQrLayer(), width: 100, height: 100, scaleX: 2, scaleY: 2 };
    expect(bakeScale(q)).toMatchObject({ width: 200, height: 200, scaleX: 1, scaleY: 1 });
    const same = img();
    expect(bakeScale(same)).toBe(same);
  });

  it("is applied to old projects when they load, on both faces", () => {
    const p = { ...newProject("t"), layers: [img({ scaleX: 2, scaleY: 2 })] };
    p.back = { layers: [img({ scaleX: 0.5, scaleY: 0.5 })] } as typeof p.back;
    const m = migrateProject(p);
    expect(m.layers[0]).toMatchObject({ width: 400, height: 200, scaleX: 1, scaleY: 1 });
    expect(m.back!.layers[0]).toMatchObject({ width: 100, height: 50, scaleX: 1, scaleY: 1 });
  });
});
