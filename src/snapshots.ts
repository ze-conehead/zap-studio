// Named snapshots of one design or template: a full copy of the project at
// a point in time, to jump back to later ("before auto-fill", "before the
// redesign"). Unlike undo history they survive a reload. Stored in
// IndexedDB next to the projects, namespaced per workspace, so deleting a
// workspace takes them along. Not part of the .zip backup.

import { del, get, keys, set } from "./idb";
import { uid } from "./factory";
import { wsIdbPrefix } from "./workspace";
import type { Project } from "./types";

const PREFIX = `${wsIdbPrefix()}snapshot:`;
const KEY = (projectId: string, id: string) => `${PREFIX}${projectId}:${id}`;

// Automatic snapshots (taken by bulk operations) are capped per project;
// the ones the user names are kept until deleted.
export const MAX_AUTO_SNAPSHOTS = 10;

// Strictly increasing, so snapshots taken in the same millisecond (a bulk
// run) still sort — and get pruned — in the order they were taken.
let lastTs = 0;
const stamp = () => (lastTs = Math.max(Date.now(), lastTs + 1));

export interface Snapshot {
  id: string;
  projectId: string;
  name: string;
  createdAt: number;
  auto?: boolean;
  project: Project;
}

async function keysOf(projectId?: string): Promise<string[]> {
  const prefix = projectId ? `${PREFIX}${projectId}:` : PREFIX;
  return ((await keys()) as unknown[]).filter(
    (k): k is string => typeof k === "string" && k.startsWith(prefix),
  );
}

/** Every snapshot of one project, newest first. */
export async function listSnapshots(projectId: string): Promise<Snapshot[]> {
  const out: Snapshot[] = [];
  for (const k of await keysOf(projectId)) {
    const s = (await get(k)) as Snapshot | undefined;
    if (s?.project) out.push(s);
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveSnapshot(
  project: Project,
  name: string,
  opts: { auto?: boolean } = {},
): Promise<Snapshot> {
  const snap: Snapshot = {
    id: uid(),
    projectId: project.id,
    name: name.trim() || new Date().toLocaleString(),
    createdAt: stamp(),
    auto: opts.auto || undefined,
    project,
  };
  await set(KEY(project.id, snap.id), snap);
  if (opts.auto) {
    const autos = (await listSnapshots(project.id)).filter((s) => s.auto);
    for (const old of autos.slice(MAX_AUTO_SNAPSHOTS)) await del(KEY(old.projectId, old.id));
  }
  return snap;
}

export async function deleteSnapshot(s: Pick<Snapshot, "projectId" | "id">): Promise<void> {
  await del(KEY(s.projectId, s.id));
}

export async function renameSnapshot(s: Snapshot, name: string): Promise<void> {
  await set(KEY(s.projectId, s.id), { ...s, name: name.trim() || s.name });
}

/** Rewrites every stored snapshot in place (bleed change, see src/bleed.ts). */
export async function mapSnapshots(fn: (p: Project) => Project): Promise<void> {
  for (const k of await keysOf()) {
    const s = (await get(k)) as Snapshot | undefined;
    if (s?.project) await set(k, { ...s, project: fn(s.project) });
  }
}
