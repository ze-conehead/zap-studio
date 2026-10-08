import { describe, expect, it } from "vitest";
import {
  getKeepView,
  recallView,
  rememberScroll,
  rememberZoom,
  scrollFraction,
  scrollFromFraction,
  setKeepView,
} from "./viewState";

describe("viewState", () => {
  it("forgets nothing but only gives it back when 'Keep view' is on", () => {
    rememberZoom(3);
    rememberScroll(0.25, 0.75);
    expect(getKeepView()).toBe(false);
    expect(recallView()).toEqual({ zoom: 1, fx: 0, fy: 0 }); // off: fit to window, like a fresh start
    setKeepView(true);
    expect(getKeepView()).toBe(true);
    expect(recallView()).toEqual({ zoom: 3, fx: 0.25, fy: 0.75 });
    setKeepView(false);
    expect(localStorage.getItem("stickerstudio:keepView")).toBeNull();
  });

  it("turns a scroll offset into a fraction of the range and back", () => {
    // a 1000 px content in a 400 px view scrolls 600 px
    expect(scrollFraction(0, 1000, 400)).toBe(0);
    expect(scrollFraction(300, 1000, 400)).toBeCloseTo(0.5);
    expect(scrollFraction(600, 1000, 400)).toBe(1);
    expect(scrollFraction(9999, 1000, 400)).toBe(1); // overscroll is clamped
    expect(scrollFromFraction(0.5, 1000, 400)).toBe(300);
    // the same spot on a card whose content is twice as wide
    expect(scrollFromFraction(0.5, 2000, 400)).toBe(800);
  });

  it("a box that can't scroll stays at 0", () => {
    expect(scrollFraction(0, 400, 400)).toBe(0);
    expect(scrollFraction(50, 300, 400)).toBe(0);
    expect(scrollFromFraction(0.7, 300, 400)).toBe(0);
  });
});
