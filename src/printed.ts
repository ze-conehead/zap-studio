// Which cards have been printed already: a set of game keys, per workspace
// (localStorage), shown in the left list's "not printed yet" filter and the
// Settings ▸ Printed cards table. The last export's selection is kept too, so
// that table can tick exactly those cards in one click.

import { wsSuffix } from "./workspace";

const PRINTED_KEY = () => `stickerstudio:printed${wsSuffix()}`;
const LAST_EXPORT_KEY = () => `stickerstudio:lastExport${wsSuffix()}`;

let version = 0;
const listeners = new Set<() => void>();
const notify = () => {
  version++;
  for (const l of listeners) l();
};
export function subscribePrinted(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const getPrintedVersion = () => version;

function readKeys(key: string): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}
function writeKeys(key: string, keys: Iterable<string>) {
  try {
    localStorage.setItem(key, JSON.stringify([...keys]));
  } catch {
    /* unavailable */
  }
  notify();
}

export const printedKeys = (): Set<string> => new Set(readKeys(PRINTED_KEY()));
export const isPrinted = (gameKey: string): boolean => printedKeys().has(gameKey);

/** Mark cards printed (or not). */
export function setPrinted(gameKeys: Iterable<string>, printed: boolean): void {
  const set = printedKeys();
  for (const k of gameKeys) {
    if (printed) set.add(k);
    else set.delete(k);
  }
  writeKeys(PRINTED_KEY(), set);
}

/** What the last "all cards" export (PNG .zip or PDF sheet) was started with. */
export const lastExportKeys = (): string[] => readKeys(LAST_EXPORT_KEY());
export function rememberExport(gameKeys: Iterable<string>): void {
  writeKeys(LAST_EXPORT_KEY(), gameKeys);
}
