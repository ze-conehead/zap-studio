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

/** Back to the saved data: reload without the in-memory flag. If the browser's
 * storage is still broken, the error screen simply comes up again. */
export function leaveMemoryMode(): void {
  try {
    sessionStorage.removeItem(FLAG);
  } catch {
    /* sessionStorage unavailable — nothing to remove */
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

// How long the start-up probe waits before it calls the storage stuck. A
// database another window has blocked (an open delete / upgrade request)
// never answers at all — without a limit that is a blank page.
export const PROBE_TIMEOUT_MS = 10_000;

/** Rejects with the browser's own error when IndexedDB can't be used — or after PROBE_TIMEOUT_MS of silence. */
export async function probeStorage(): Promise<void> {
  if (useMem) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () =>
        reject(
          new Error(
            `The browser's storage didn't answer within ${PROBE_TIMEOUT_MS / 1000} seconds — another window or tab of this app may be holding it.`,
          ),
        ),
      PROBE_TIMEOUT_MS,
    );
  });
  try {
    await Promise.race([
      (async () => {
        await real.set("__probe__", Date.now());
        await real.get("__probe__");
        await real.del("__probe__");
      })(),
      timeout,
    ]);
  } finally {
    clearTimeout(timer);
  }
}
