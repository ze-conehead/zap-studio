import { describe, expect, it, vi } from "vitest";

vi.mock("./autoFill", () => ({
  planAutoFill: async () => {
    const row = (k: string) => ({ gameKey: k, consoleName: "C", gameTitle: k });
    return {
      logoSlot: false,
      logos: [],
      covers: [
        { row: row("c/a"), masks: [{}], of: 1 },
        { row: row("c/b"), masks: [{}], of: 1 },
      ],
      screenshots: [
        { row: row("c/b"), masks: [{}, {}], of: 3 },
        { row: row("c/c"), masks: [{}, {}, {}], of: 3 },
      ],
    };
  },
}));

import { loadPictureGaps } from "./collection";

describe("loadPictureGaps", () => {
  it("combines the cover and screenshot gaps per card", async () => {
    const gaps = await loadPictureGaps();
    expect(gaps.get("c/a")).toEqual({ cover: true, shotsMissing: 0, shotsTotal: 0 });
    expect(gaps.get("c/b")).toEqual({ cover: true, shotsMissing: 2, shotsTotal: 3 });
    expect(gaps.get("c/c")).toEqual({ cover: false, shotsMissing: 3, shotsTotal: 3 });
    expect(gaps.has("c/d")).toBe(false);
  });
});
