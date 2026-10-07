import { describe, expect, it, vi } from "vitest";

// The in-memory fallback is chosen once at import time (from sessionStorage),
// so each case imports a fresh copy of the module.
async function load(memory: boolean) {
  vi.resetModules();
  sessionStorage.clear();
  if (memory) sessionStorage.setItem("zap-studio:memory-storage", "1");
  return import("./idb");
}

describe("idb", () => {
  it("memory mode stores, lists and deletes without touching IndexedDB", async () => {
    const db = await load(true);
    expect(db.memoryMode()).toBe(true);
    await db.set("a", { n: 1 });
    await db.set("b", 2);
    expect(await db.get("a")).toEqual({ n: 1 });
    expect((await db.keys()).sort()).toEqual(["a", "b"]);
    await db.del("a");
    expect(await db.get("a")).toBeUndefined();
    await expect(db.probeStorage()).resolves.toBeUndefined();
  });

  it("normal mode round-trips through IndexedDB and the probe leaves nothing behind", async () => {
    const db = await load(false);
    expect(db.memoryMode()).toBe(false);
    await db.set("k", "v");
    expect(await db.get("k")).toBe("v");
    await db.probeStorage();
    expect(await db.get("__probe__")).toBeUndefined();
    expect(await db.keys()).toContain("k");
  });
});

describe("probeStorage", () => {
  it("rejects with the browser's own error when IndexedDB is broken", async () => {
    vi.resetModules();
    sessionStorage.clear();
    const broken = new DOMException("Internal error.", "UnknownError");
    vi.doMock("idb-keyval", () => ({
      get: () => Promise.reject(broken),
      set: () => Promise.reject(broken),
      del: () => Promise.reject(broken),
      keys: () => Promise.reject(broken),
    }));
    const db = await import("./idb");
    await expect(db.probeStorage()).rejects.toBe(broken);
    vi.doUnmock("idb-keyval");
  });

  it("gives up with a clear message when the storage never answers", async () => {
    vi.resetModules();
    sessionStorage.clear();
    vi.useFakeTimers();
    try {
      const never = () => new Promise(() => {});
      vi.doMock("idb-keyval", () => ({ get: never, set: never, del: never, keys: never }));
      const db = await import("./idb");
      const outcome = db.probeStorage().then(
        () => "resolved",
        (e: Error) => e.message,
      );
      await vi.advanceTimersByTimeAsync(db.PROBE_TIMEOUT_MS + 1);
      expect(await outcome).toMatch(/didn't answer within 10 seconds/);
    } finally {
      vi.useRealTimers();
      vi.doUnmock("idb-keyval");
    }
  });
});
