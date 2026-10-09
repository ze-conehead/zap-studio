import { describe, expect, it } from "vitest";
import { FORMATS } from "./formats";

describe("formats", () => {
  it("every multi-panel format's panels add up to its trim width", () => {
    for (const f of Object.values(FORMATS)) {
      if (!f.panels) continue;
      const sum = f.panels.reduce((s, p) => s + p.wMM, 0);
      expect(sum, f.id).toBeCloseTo(f.trimMM.w, 3);
    }
  });

  it("the cassette J-card is flap 1\", spine ½\", front — 10.3 × 10.2 cm", () => {
    const j = FORMATS["cassette-jcard"];
    expect(j.panels).toEqual([
      { name: "Flap", wMM: 25.4 },
      { name: "Spine", wMM: 12.7 },
      { name: "Front", wMM: 65.087 },
    ]);
    expect(j.trimMM.h).toBe(102);
    expect(j.trimMM.w).toBeCloseTo(103.187, 3);
  });
});
