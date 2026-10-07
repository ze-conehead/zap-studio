import { describe, expect, it } from "vitest";
import { TRIM_RECT, PX_PER_MM } from "./card";
import { DEFAULT_SHEET_OPTIONS, planPaperSheet, type SheetOptions } from "./sheet";

const opts = (over: Partial<SheetOptions> = {}): SheetOptions => ({
  ...DEFAULT_SHEET_OPTIONS,
  target: "a4",
  ...over,
});
const trimW = TRIM_RECT.w / PX_PER_MM; // 54 mm for the credit card
const trimH = TRIM_RECT.h / PX_PER_MM; // 85.6 mm

describe("planPaperSheet", () => {
  it("is only for paper targets", () => {
    expect(planPaperSheet(opts({ target: "cricut" }))).toEqual({});
  });

  it("automatic: as many full-bleed cards as fit, portrait unless landscape holds more", () => {
    const r = planPaperSheet(opts({ gapMM: 3, marginMM: 8 })).plan!;
    expect(r.orientation).toBe("portrait");
    expect(r.cols * r.rows).toBe(9); // 3 × 3 on A4 (landscape would be 4 × 2)
  });

  it("can be forced to landscape", () => {
    const r = planPaperSheet(opts({ orientation: "landscape", gapMM: 3, marginMM: 8 })).plan!;
    expect([r.orientation, r.pageWMM, r.pageHMM]).toEqual(["landscape", 297, 210]);
    expect(r.cols * r.rows).toBe(8);
  });

  it("a fixed grid picks the orientation it fits on", () => {
    // 5 × 2 cards of 54 × 85.6 mm, touching: 270 × 171.2 mm — landscape Letter.
    const r = planPaperSheet(opts({ target: "letter", grid: { cols: 5, rows: 2 }, gapMM: 0, marginMM: 4 }));
    expect(r.plan).toMatchObject({ orientation: "landscape", cols: 5, rows: 2 });
    // 2 × 2 fits portrait, which wins the tie.
    const small = planPaperSheet(opts({ grid: { cols: 2, rows: 2 }, gapMM: 3 })).plan!;
    expect(small.orientation).toBe("portrait");
  });

  it("says what a grid that doesn't fit would need, and which margin would do", () => {
    const r = planPaperSheet(opts({ target: "letter", grid: { cols: 5, rows: 2 }, gapMM: 0, marginMM: 8 }));
    expect(r.plan).toBeUndefined();
    expect(r.need?.w).toBeCloseTo(5 * trimW);
    expect(r.need?.h).toBeCloseTo(2 * trimH);
    expect(r.avail?.w).toBeCloseTo(279.4 - 16);
    // (279.4 − 5 × 54.02) / 2 ≈ 4.65 mm — the card is a whole number of px wide
    expect(r.maxMargin).toBe(4.6);
    // …at that margin it fits, a hair more and it doesn't
    const at = (marginMM: number) =>
      planPaperSheet(opts({ target: "letter", grid: { cols: 5, rows: 2 }, gapMM: 0, marginMM })).plan;
    expect(at(4.6)).toBeDefined();
    expect(at(4.7)).toBeUndefined();
  });

  it("an orientation that's forced is the only one tried", () => {
    const r = planPaperSheet(opts({ target: "letter", orientation: "portrait", grid: { cols: 5, rows: 2 }, gapMM: 0, marginMM: 4 }));
    expect(r.plan).toBeUndefined();
  });
});
