import { describe, expect, it } from "vitest";
import { isSnapSuspended } from "./snapSuspend";

const key = (type: "keydown" | "keyup", k: string, mods: KeyboardEventInit = {}) =>
  window.dispatchEvent(new KeyboardEvent(type, { key: k, ...mods }));

describe("Ctrl pauses snapping", () => {
  it("is on while Ctrl (or ⌘) is down and off again when it comes up", () => {
    expect(isSnapSuspended()).toBe(false);
    key("keydown", "Control", { ctrlKey: true });
    expect(isSnapSuspended()).toBe(true);
    key("keyup", "Control");
    expect(isSnapSuspended()).toBe(false);
    key("keydown", "Meta", { metaKey: true });
    expect(isSnapSuspended()).toBe(true);
    key("keyup", "Meta");
    expect(isSnapSuspended()).toBe(false);
  });

  it("any pointer move resyncs it, so a missed key-up can't leave it stuck", () => {
    key("keydown", "Control", { ctrlKey: true });
    expect(isSnapSuspended()).toBe(true);
    window.dispatchEvent(new MouseEvent("mousemove", { ctrlKey: false }));
    expect(isSnapSuspended()).toBe(false);
    window.dispatchEvent(new MouseEvent("mousemove", { ctrlKey: true }));
    expect(isSnapSuspended()).toBe(true);
    window.dispatchEvent(new Event("blur"));
    expect(isSnapSuspended()).toBe(false);
  });

  it("other keys with Ctrl still down keep it on, and releasing another key does not end it", () => {
    key("keydown", "Control", { ctrlKey: true });
    key("keydown", "a", { ctrlKey: true });
    key("keyup", "a", { ctrlKey: true });
    expect(isSnapSuspended()).toBe(true);
    key("keyup", "Control");
    expect(isSnapSuspended()).toBe(false);
  });
});
