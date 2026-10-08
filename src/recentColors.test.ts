import { beforeEach, describe, expect, it } from "vitest";
import { INLINE_RECENT, MAX_RECENT, recentColors, rememberColor, ROW_SIZE } from "./recentColors";

const hex = (i: number) => `#${i.toString(16).padStart(6, "0")}`;

describe("recent colours", () => {
  beforeEach(() => {
    // Flush whatever an earlier test left in the shared list.
    for (let i = 0; i < MAX_RECENT; i++) rememberColor(hex(0xa00000 + i));
  });

  it("keeps the inline swatches plus four extra rows, newest first", () => {
    expect(MAX_RECENT).toBe(INLINE_RECENT + 4 * ROW_SIZE);
    for (let i = 1; i <= MAX_RECENT + 5; i++) rememberColor(hex(i));
    const list = recentColors();
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0]).toBe(hex(MAX_RECENT + 5));
    expect(list.at(-1)).toBe(hex(6));
  });

  it("moves a re-picked colour to the front without duplicating it", () => {
    rememberColor("#112233");
    rememberColor("#445566");
    rememberColor("#112233");
    expect(recentColors().slice(0, 2)).toEqual(["#112233", "#445566"]);
    expect(recentColors().filter((c) => c === "#112233")).toHaveLength(1);
  });

  it("ignores anything that is not a #rrggbb colour", () => {
    const before = [...recentColors()];
    rememberColor("{accent}");
    rememberColor("red");
    expect(recentColors()).toEqual(before);
  });
});
