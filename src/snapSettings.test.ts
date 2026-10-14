import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SNAP_STRENGTH, getSnapStrength, MAX_SNAP_STRENGTH, MIN_SNAP_STRENGTH, setSnapStrength } from "./snapSettings";

beforeEach(() => localStorage.clear());

describe("snap strength", () => {
  it("is 7 px until changed", () => {
    expect(getSnapStrength()).toBe(DEFAULT_SNAP_STRENGTH);
    expect(DEFAULT_SNAP_STRENGTH).toBe(7);
  });

  it("remembers a choice, keeping it within range and whole", () => {
    setSnapStrength(15);
    expect(getSnapStrength()).toBe(15);
    setSnapStrength(1000);
    expect(getSnapStrength()).toBe(MAX_SNAP_STRENGTH);
    setSnapStrength(-4);
    expect(getSnapStrength()).toBe(MIN_SNAP_STRENGTH);
    setSnapStrength(9.6);
    expect(getSnapStrength()).toBe(10);
  });

  it("the default stores nothing, and junk in storage falls back to it", () => {
    setSnapStrength(12);
    setSnapStrength(DEFAULT_SNAP_STRENGTH);
    expect(localStorage.getItem("stickerstudio:snapStrength")).toBeNull();
    localStorage.setItem("stickerstudio:snapStrength", "abc");
    expect(getSnapStrength()).toBe(DEFAULT_SNAP_STRENGTH);
  });
});
