import { get, set, del, keys } from "idb-keyval";
import type { Project, ProjectMeta } from "./types";

// Projects (with embedded image data URLs) live in IndexedDB so large
// uploads don't blow the localStorage quota.

const KEY = (id: string) => `project:${id}`;
const LAST = "lastProjectId";

export async function saveProject(p: Project): Promise<void> {
  await set(KEY(p.id), p);
  if (!p.isTemplate) localStorage.setItem(LAST, p.id);
}

export async function loadProject(id: string): Promise<Project | undefined> {
  return (await get(KEY(id))) as Project | undefined;
}


export async function deleteProject(id: string): Promise<void> {
  await del(KEY(id));
  if (localStorage.getItem(LAST) === id) localStorage.removeItem(LAST);
}

export function lastProjectId(): string | null {
  return localStorage.getItem(LAST);
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const ks = (await keys()) as string[];
  const ids = ks.filter((k) => typeof k === "string" && k.startsWith("project:"));
  const metas: ProjectMeta[] = [];
  for (const k of ids) {
    const p = (await get(k)) as Project | undefined;
    if (p && !p.isTemplate) metas.push({ id: p.id, name: p.name, updatedAt: p.updatedAt });
  }
  return metas.sort((a, b) => b.updatedAt - a.updatedAt);
}

// Every stored project, templates included — for the full backup.
export async function loadAllProjects(): Promise<Project[]> {
  const ks = (await keys()) as string[];
  const out: Project[] = [];
  for (const k of ks) {
    if (typeof k === "string" && k.startsWith("project:")) {
      const p = (await get(k)) as Project | undefined;
      if (p) out.push(p);
    }
  }
  return out;
}
