// Workspaces: independent sets of consoles, cards and templates. Everything
// the app stores is namespaced by the active one, so a new workspace starts
// genuinely empty — no example consoles, no cards, no templates — instead of
// mixing into the existing library.
//
// The original workspace keeps the unsuffixed keys, so upgrading changes
// nothing on disk. Switching reloads the page, exactly like switching format:
// the ids below are read once at module load.

export interface Workspace {
  id: string; // "" = the original workspace
  name: string;
  createdAt: number;
  seeded: boolean; // false => starts with an empty catalogue
  format?: string; // FormatId it was created with — shown in the list
}

const LIST_KEY = "stickerstudio:workspaces";
const ACTIVE_KEY = "stickerstudio:workspace";

export const DEFAULT_WS = "";

const ls = {
  get(k: string): string {
    try {
      return localStorage.getItem(k) ?? "";
    } catch {
      return "";
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* unavailable */
    }
  },
  remove(k: string): void {
    try {
      localStorage.removeItem(k);
    } catch {
      /* unavailable */
    }
  },
};

function readList(): Workspace[] {
  try {
    const raw = JSON.parse(ls.get(LIST_KEY) || "[]") as Workspace[];
    if (Array.isArray(raw)) {
      return raw.filter((w) => w && typeof w.id === "string" && w.id !== DEFAULT_WS);
    }
  } catch {
    /* fall through */
  }
  return [];
}

const writeList = (list: Workspace[]) => ls.set(LIST_KEY, JSON.stringify(list));

/** Every workspace, the original one first. */
export function listWorkspaces(): Workspace[] {
  return [
    { id: DEFAULT_WS, name: defaultName(), createdAt: 0, seeded: true },
    ...readList().sort((a, b) => a.createdAt - b.createdAt),
  ];
}

// Named lazily so the i18n module isn't pulled into this one.
let defaultLabel = "Main project";
export const setDefaultWorkspaceName = (s: string) => (defaultLabel = s);
const defaultName = () => defaultLabel;

// Read once — the whole app assumes this can't change without a reload.
const active = (() => {
  const id = ls.get(ACTIVE_KEY);
  return id && readList().some((w) => w.id === id) ? id : DEFAULT_WS;
})();

export const getWorkspaceId = () => active;

export function getWorkspace(): Workspace {
  return listWorkspaces().find((w) => w.id === active) ?? listWorkspaces()[0];
}

/** True when the active workspace shows the built-in example consoles. */
export const isSeededWorkspace = () => getWorkspace().seeded;

/** Suffix for localStorage keys and template ids ("" for the original). */
export const wsSuffix = () => (active === DEFAULT_WS ? "" : `--w${active}`);

/**
 * Prefix for IndexedDB keys. Deliberately a different scheme rather than an
 * empty string, so `project:…` scans of the original workspace can never
 * match another workspace's rows.
 */
export const wsIdbPrefix = () => (active === DEFAULT_WS ? "" : `ws:${active}:`);

const newId = () =>
  (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).slice(0, 8);

export function createWorkspace(
  name: string,
  opts: { seeded?: boolean; format?: string } = {},
): Workspace {
  const ws: Workspace = {
    id: newId(),
    name: name.trim() || "Project",
    createdAt: Date.now(),
    seeded: !!opts.seeded,
    format: opts.format,
  };
  writeList([...readList(), ws]);
  // src/formats.ts reads this key through wsSuffix(), so seeding it here is
  // all it takes for the new project to open in the chosen format. The
  // example catalogue itself is written by seedWorkspace() in the dialog.
  if (opts.format) ls.set(`stickerstudio:format--w${ws.id}`, opts.format);
  return ws;
}

/** Keeps the record in step when the format is changed from the menu. */
export function setWorkspaceFormat(format: string): void {
  if (active === DEFAULT_WS) return; // the original has no stored record
  writeList(readList().map((w) => (w.id === active ? { ...w, format } : w)));
}

export function renameWorkspace(id: string, name: string): void {
  const clean = name.trim();
  if (!clean) return;
  if (id === DEFAULT_WS) return; // the original one has no stored record
  writeList(readList().map((w) => (w.id === id ? { ...w, name: clean } : w)));
}

/** Persists the choice and reloads, so every module re-reads its keys. */
export function switchWorkspace(id: string): void {
  if (id === active) return;
  if (id === DEFAULT_WS) ls.remove(ACTIVE_KEY);
  else ls.set(ACTIVE_KEY, id);
  location.reload();
}

/**
 * Removes a workspace and everything it owns. Returns the keys it dropped so
 * the caller can report the size of what just happened.
 */
export async function deleteWorkspace(
  id: string,
  idb: { keys(): Promise<IDBValidKey[]>; del(key: IDBValidKey): Promise<void> },
): Promise<number> {
  if (id === DEFAULT_WS) return 0; // never wipe the original
  const idbPrefix = `ws:${id}:`;
  const lsSuffix = `--w${id}`;

  let removed = 0;
  for (const k of await idb.keys()) {
    if (typeof k === "string" && k.startsWith(idbPrefix)) {
      await idb.del(k);
      removed++;
    }
  }
  const doomed: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.endsWith(lsSuffix)) doomed.push(k);
    }
  } catch {
    /* unavailable */
  }
  for (const k of doomed) {
    ls.remove(k);
    removed++;
  }

  writeList(readList().filter((w) => w.id !== id));
  if (active === id) ls.remove(ACTIVE_KEY);
  return removed;
}
