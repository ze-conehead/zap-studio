// The last colours picked in any colour field, shown as swatches under
// every picker so a palette can be reused across layers and cards. One
// list for the whole app (localStorage), newest first. The newest
// INLINE_RECENT sit right under the picker; the older ones are in a
// dropdown, EXTRA_ROWS rows of ROW_SIZE.

const KEY = "stickerstudio:recentColors";
export const INLINE_RECENT = 10;
export const ROW_SIZE = 10;
export const EXTRA_ROWS = 4;
export const MAX_RECENT = INLINE_RECENT + ROW_SIZE * EXTRA_ROWS;

let cache: string[] | null = null;
let version = 0;
const listeners = new Set<() => void>();

function load(): string[] {
  if (cache) return cache;
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    cache = Array.isArray(raw) ? raw.filter((c) => typeof c === "string") : [];
  } catch {
    cache = [];
  }
  return cache;
}

export function subscribeRecentColors(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getRecentColorsVersion = () => version;

export function recentColors(): string[] {
  return load();
}

/** Puts `color` at the front (once), dropping the oldest past MAX_RECENT. */
export function rememberColor(color: string): void {
  const c = color.trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(c)) return;
  const next = [c, ...load().filter((x) => x !== c)].slice(0, MAX_RECENT);
  cache = next;
  version++;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* unavailable */
  }
  for (const l of listeners) l();
}
