// The last few colours picked in any colour field, shown as swatches under
// every picker so a palette can be reused across layers and cards. One
// list for the whole app (localStorage), newest first.

const KEY = "stickerstudio:recentColors";
const MAX = 10;

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

/** Puts `color` at the front (once), dropping the oldest past MAX. */
export function rememberColor(color: string): void {
  const c = color.trim().toLowerCase();
  if (!/^#[0-9a-f]{6}$/.test(c)) return;
  const next = [c, ...load().filter((x) => x !== c)].slice(0, MAX);
  cache = next;
  version++;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* unavailable */
  }
  for (const l of listeners) l();
}
