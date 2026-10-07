import { describe, expect, it } from "vitest";
import { EXPORT_MODES, modeFor } from "./export";

describe("modeFor", () => {
  it("maps the bleed / crop-marks choice onto an export mode", () => {
    expect(modeFor(false, false)).toBe("trim");
    expect(modeFor(true, false)).toBe("bleed");
    expect(modeFor(true, true)).toBe("marks");
    expect(modeFor(false, true)).toBe("trim-marks");
  });

  it("the all-cards export keeps offering its three classic modes", () => {
    expect(EXPORT_MODES).toEqual(["trim", "bleed", "marks"]);
  });
});
