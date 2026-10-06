import { describe, expect, it } from "vitest";
import { applyContrast, CONTRAST_DARK, CONTRAST_LIGHT, CONTRAST_TOKEN } from "./contrast";
import { makeShapeLayer, makeTextLayer } from "./factory";
import type { CardBackground, Layer } from "./types";

// A text frame (fixed height — jsdom can't measure text) painted with the token.
const label = (over: Partial<Layer> = {}): Layer =>
  ({ ...makeTextLayer("Hi"), flow: true, height: 40, width: 120, fill: CONTRAST_TOKEN, ...over }) as Layer;
const solid = (color: string): CardBackground => ({
  kind: "solid",
  color,
  color2: color,
  angle: 0,
  noise: 0,
});

describe("applyContrast", () => {
  it("goes dark on a light shape under it, light on a dark one", () => {
    const t = label();
    const light = { ...makeShapeLayer("rect"), x: t.x, y: t.y, fill: solid("#f5f5f5") };
    const dark = { ...light, fill: solid("#101010") };
    expect((applyContrast([light, t], null)[1] as { fill: string }).fill).toBe(CONTRAST_DARK);
    expect((applyContrast([dark, t], null)[1] as { fill: string }).fill).toBe(CONTRAST_LIGHT);
  });

  it("only looks at what's under it, then at the background", () => {
    const t = label();
    const elsewhere = { ...makeShapeLayer("rect"), x: t.x + 5000, fill: solid("#ffffff") };
    expect((applyContrast([elsewhere, t], solid("#ffffff"))[1] as { fill: string }).fill).toBe(CONTRAST_DARK);
    expect((applyContrast([elsewhere, t], solid("#000000"))[1] as { fill: string }).fill).toBe(CONTRAST_LIGHT);
  });

  it("leaves layers without the token alone", () => {
    const plain = makeTextLayer("x");
    const list = [plain];
    expect(applyContrast(list, null)).toBe(list);
  });
});
