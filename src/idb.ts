// The app's IndexedDB access — idb-keyval, plus a way out when the browser's
// storage is broken. Chrome can answer every IndexedDB call with
// "UnknownError: Internal error" (a damaged profile store, a stuck lock, a
// full disk); without this the app would sit on "loading …" forever. After
// the user picks "Open without saved data" on the error screen, everything
// here runs against an in-memory map for that tab session instead: nothing
// is stored, but the app is usable and a backup .zip can still be imported
// and exported.

import * as real from "idb-keyval";

const FLAG = "zap-studio:memory-storage";

export const memoryMode = (): boolean => {
  try {
    return sessionStorage.getItem(FLAG) === "1";
  } catch {
    return false;
  }
};

/** Reload the page running on a throw-away in-memory store. */
export function enterMemoryMode(): void {
  try {
    sessionStorage.setItem(FLAG, "1");
  } catch {
    /* sessionStorage unavailable — the reload below just retries */
  }
  location.reload();
}

const mem = new Map<IDBValidKey, unknown>();
const useMem = memoryMode();

export const get = <T = unknown>(key: IDBValidKey): Promise<T | undefined> =>
  useMem ? Promise.resolve(mem.get(key) as T | undefined) : real.get<T>(key);

export const set = (key: IDBValidKey, value: unknown): Promise<void> => {
  if (!useMem) return real.set(key, value);
  mem.set(key, value);
  return Promise.resolve();
};

export const del = (key: IDBValidKey): Promise<void> => {
  if (!useMem) return real.del(key);
  mem.delete(key);
  return Promise.resolve();
};

export const keys = <K extends IDBValidKey = IDBValidKey>(): Promise<K[]> =>
  useMem ? Promise.resolve([...mem.keys()] as K[]) : real.keys<K>();

/** Rejects with the browser's own error when storage can't be used. */
export async function probeStorage(): Promise<void> {
  if (useMem) return;
  await real.set("__probe__", Date.now());
  await real.get("__probe__");
  await real.del("__probe__");
}
