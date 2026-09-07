import { get, set, del, keys } from "idb-keyval";
import { migrateProject } from "./factory";
import { linkGameProject } from "./gameIndex";
import { wsIdbPrefix, wsSuffix } from "./workspace";
import { getFormatId } from "./formats";
import type { Project, ProjectMeta } from "./types";

// Projects (with embedded image data URLs) live in IndexedDB so large
// uploads don't blow the localStorage quota.

// Namespaced per workspace — see src/workspace.ts. The original workspace
// keeps the bare `project:` / `lastProjectId` keys.
const NS = wsIdbPrefix();
const PROJECT_PREFIX = `${NS}project:`;
const TRASH_PREFIX = `${NS}trash:`;
const KEY = (id: string) => `${PROJECT_PREFIX}${id}`;
const LAST = `lastProjectId${wsSuffix()}`;

export async function saveProject(p: Project): Promise<void> {
  await set(KEY(p.id), p);
  if (!p.isTemplate) localStorage.setItem(LAST, p.id);
}

export async function loadProject(id: string): Promise<Project | undefined> {
  const p = (await get(KEY(id))) as Project | undefined;
  return p ? migrateProject(p) : undefined;
}


// ── trash ──────────────────────────────────────────────────────────────────
// Deleting moves the project aside instead of dropping it, so a mis-click
// costs a click to undo rather than the whole design. Entries older than
// TRASH_DAYS are purged on boot.

const TRASH = (id: string) => `${TRASH_PREFIX}${id}`;
export const TRASH_DAYS = 30;

export interface TrashEntry {
  project: Project;
  deletedAt: number;
}

export async function deleteProject(id: string): Promise<void> {
  const p = (await get(KEY(id))) as Project | undefined;
  if (p) await set(TRASH(id), { project: p, deletedAt: Date.now() } as TrashEntry);
  await del(KEY(id));
  if (localStorage.getItem(LAST) === id) localStorage.removeItem(LAST);
}

export async function listTrash(): Promise<TrashEntry[]> {
  const ks = (await keys()) as string[];
  const out: TrashEntry[] = [];
  for (const k of ks) {
    if (typeof k !== "string" || !k.startsWith(TRASH_PREFIX)) continue;
    const e = (await get(k)) as TrashEntry | undefined;
    if (e?.project) out.push(e);
  }
  return out.sort((a, b) => b.deletedAt - a.deletedAt);
}

/** Puts a project back and re-links it to its catalogue game. */
export async function restoreProject(id: string): Promise<Project | undefined> {
  const e = (await get(TRASH(id))) as TrashEntry | undefined;
  if (!e?.project) return undefined;
  await set(KEY(id), e.project);
  await del(TRASH(id));
  if (e.project.gameKey) linkGameProject(e.project.gameKey, id);
  return e.project;
}

export async function purgeTrashEntry(id: string): Promise<void> {
  await del(TRASH(id));
}

export async function emptyTrash(): Promise<number> {
  const ks = (await keys()) as string[];
  let n = 0;
  for (const k of ks) {
    if (typeof k === "string" && k.startsWith(TRASH_PREFIX)) {
      await del(k);
      n++;
    }
  }
  return n;
}

/** Drops anything that has sat in the trash for longer than TRASH_DAYS. */
export async function purgeOldTrash(): Promise<void> {
  const cutoff = Date.now() - TRASH_DAYS * 86_400_000;
  const ks = (await keys()) as string[];
  for (const k of ks) {
    if (typeof k !== "string" || !k.startsWith(TRASH_PREFIX)) continue;
    const e = (await get(k)) as TrashEntry | undefined;
    if (!e || e.deletedAt < cutoff) await del(k);
  }
}

export function lastProjectId(): string | null {
  return localStorage.getItem(LAST);
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const ks = (await keys()) as string[];
  const ids = ks.filter((k) => typeof k === "string" && k.startsWith(PROJECT_PREFIX));
  const metas: ProjectMeta[] = [];
  const fmt = getFormatId();
  for (const k of ids) {
    const p = (await get(k)) as Project | undefined;
    if (p && !p.isTemplate && (p.format ?? "card") === fmt) {
      metas.push({ id: p.id, name: p.name, updatedAt: p.updatedAt });
    }
  }
  return metas.sort((a, b) => b.updatedAt - a.updatedAt);
}

// Every stored project, templates included — for the full backup.
export async function loadAllProjects(): Promise<Project[]> {
  const ks = (await keys()) as string[];
  const out: Project[] = [];
  for (const k of ks) {
    if (typeof k === "string" && k.startsWith(PROJECT_PREFIX)) {
      const p = (await get(k)) as Project | undefined;
      if (p) out.push(p);
    }
  }
  return out;
}
