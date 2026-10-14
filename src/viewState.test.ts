import { describe, expect, it } from "vitest";
import {
  getKeepView,
  recallView,
  rememberScroll,
  rememberZoom,
  scrollFraction,
  scrollFromFraction,
  setKeepView, scrollDeltaToCenter, visiblePart } from "./viewState";

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

describe("minimap geometry", () => {
  const card = { left: 100, top: 50, width: 400, height: 600 };

  it("is full when the whole card is inside the view", () => {
    const r = visiblePart(card, { left: 0, top: 0, width: 1000, height: 1000 });
    expect(r.full).toBe(true);
    expect(r).toMatchObject({ x: 0, y: 0, w: 1, h: 1 });
  });

  it("is the part of the card the view covers, as fractions of the card", () => {
    // the view starts 100 px into the card and 150 px down, 200 × 300 big
    const r = visiblePart(card, { left: 200, top: 200, width: 200, height: 300 });
    expect(r.full).toBe(false);
    expect(r.x).toBeCloseTo(0.25);
    expect(r.y).toBeCloseTo(0.25);
    expect(r.w).toBeCloseTo(0.5);
    expect(r.h).toBeCloseTo(0.5);
  });

  it("clips a view that hangs over the card's edge", () => {
    const r = visiblePart(card, { left: 400, top: -100, width: 300, height: 400 }); // sticks out right and top
    expect(r.x).toBeCloseTo(0.75);
    expect(r.y).toBeCloseTo(0);
    expect(r.w).toBeCloseTo(0.25);
    expect(r.h).toBeCloseTo(250 / 600);
  });

  it("a hair of rounding doesn't count as cut off", () => {
    expect(visiblePart(card, { left: 101, top: 50, width: 399, height: 600 }).full).toBe(true);
    expect(visiblePart(card, { left: 130, top: 50, width: 370, height: 600 }).full).toBe(false);
  });

  it("works out how far to scroll to centre a card point in the view", () => {
    const view = { left: 0, top: 0, width: 300, height: 200 };
    // the card's centre (300, 350) → the view's centre is (150, 100)
    expect(scrollDeltaToCenter(card, view, 0.5, 0.5)).toEqual({ dx: 150, dy: 250 });
    // the card's top-left corner (100, 50)
    expect(scrollDeltaToCenter(card, view, 0, 0)).toEqual({ dx: -50, dy: -50 });
  });
});
