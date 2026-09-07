// Automatic backups. The app keeps everything in IndexedDB, which a cleared
// browser profile wipes without warning, so this writes the same .zip that
// File ▸ Save backup produces into a real folder on disk — picked once, then
// refreshed on its own and rotated so the folder never grows without bound.
//
// Needs the File System Access API (Chromium). Where it is missing everything
// below reports "unsupported" and the manual backup stays the only route.

import { useSyncExternalStore } from "react";
import { get, set, del } from "idb-keyval";
import { exportBackup } from "./backup";
import { loadAllProjects } from "./persist";

const DIR_KEY = "autobackup:dir";
const SETTINGS_KEY = "stickerstudio:autobackup";
const PREFIX = "sticker-studio-backup_";

export interface AutoBackupSettings {
  enabled: boolean;
  everyMin: number; // minimum gap between two automatic runs
  keep: number; // how many .zip files to leave in the folder
}

export const DEFAULT_SETTINGS: AutoBackupSettings = {
  enabled: true,
  everyMin: 30,
  keep: 10,
};

/** How old the newest backup may get before the UI nags, in days. */
export const STALE_DAYS = 7;

export type BackupState =
  | "unsupported" // no File System Access API
  | "off" // no folder picked yet
  | "needs-permission" // folder picked, but the browser wants a fresh grant
  | "ready";

export interface BackupStatus {
  state: BackupState;
  folder: string; // directory name, "" when none
  lastAt: number; // epoch ms, 0 = never
  lastError: string;
  running: boolean;
  settings: AutoBackupSettings;
}

// ── stored bits ────────────────────────────────────────────────────────────

const LAST_AT = "stickerstudio:lastBackupAt";
const LAST_SIG = "stickerstudio:lastBackupSig";

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k) ?? "";
    } catch {
      return "";
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* unavailable */
    }
  },
};

export function getSettings(): AutoBackupSettings {
  try {
    const raw = JSON.parse(ls.get(SETTINGS_KEY) || "null") as Partial<AutoBackupSettings>;
    if (raw) {
      return {
        enabled: raw.enabled !== false,
        everyMin: Math.max(5, Number(raw.everyMin) || DEFAULT_SETTINGS.everyMin),
        keep: Math.max(1, Number(raw.keep) || DEFAULT_SETTINGS.keep),
      };
    }
  } catch {
    /* fall through */
  }
  return { ...DEFAULT_SETTINGS };
}

export function setSettings(next: Partial<AutoBackupSettings>): void {
  ls.set(SETTINGS_KEY, JSON.stringify({ ...getSettings(), ...next }));
  notify();
}

export const lastBackupAt = () => Number(ls.get(LAST_AT)) || 0;

export const isSupported = () =>
  typeof window !== "undefined" && "showDirectoryPicker" in window;

/** True once the newest backup is older than STALE_DAYS (or never ran). */
export function isStale(): boolean {
  const at = lastBackupAt();
  return Date.now() - at > STALE_DAYS * 86_400_000;
}

// ── the folder handle ──────────────────────────────────────────────────────

type DirHandle = FileSystemDirectoryHandle;

let dirHandle: DirHandle | null = null;
let loaded = false;

async function handle(): Promise<DirHandle | null> {
  if (!loaded) {
    dirHandle = ((await get(DIR_KEY)) as DirHandle | undefined) ?? null;
    loaded = true;
  }
  return dirHandle;
}

async function permission(h: DirHandle, ask: boolean): Promise<boolean> {
  const opts = { mode: "readwrite" } as const;
  // Some handle sources (OPFS) don't implement the permission methods at all
  // and are always writable.
  if (typeof h.queryPermission !== "function") return true;
  if ((await h.queryPermission(opts)) === "granted") return true;
  // Requesting needs a user gesture, so only try when the user just clicked.
  if (!ask) return false;
  return (await h.requestPermission(opts)) === "granted";
}

/** Asks for a folder. Must be called from a user gesture. */
export async function chooseFolder(): Promise<void> {
  if (!isSupported()) throw new Error("unsupported");
  const picked = await window.showDirectoryPicker({
    id: "stickerstudio-backups",
    mode: "readwrite",
    startIn: "documents",
  });
  await set(DIR_KEY, picked);
  dirHandle = picked;
  loaded = true;
  setSettings({ enabled: true });
  await runBackup({ force: true, ask: true });
}

export async function forgetFolder(): Promise<void> {
  await del(DIR_KEY);
  dirHandle = null;
  loaded = true;
  notify();
}

// ── status (pub/sub, like the theme) ───────────────────────────────────────

const listeners = new Set<() => void>();
let status: BackupStatus = {
  state: isSupported() ? "off" : "unsupported",
  folder: "",
  lastAt: lastBackupAt(),
  lastError: "",
  running: false,
  settings: getSettings(),
};

function notify(patch: Partial<BackupStatus> = {}): void {
  status = {
    ...status,
    ...patch,
    lastAt: patch.lastAt ?? lastBackupAt(),
    settings: patch.settings ?? getSettings(),
  };
  for (const fn of listeners) fn();
}

export function subscribeBackup(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const getBackupStatus = () => status;

/** Re-renders the component whenever a backup runs or its settings change. */
export function useBackupStatus(): BackupStatus {
  return useSyncExternalStore(subscribeBackup, getBackupStatus, getBackupStatus);
}

/** Re-reads the folder handle and its permission, without prompting. */
export async function refreshStatus(): Promise<void> {
  if (!isSupported()) return notify({ state: "unsupported" });
  const h = await handle();
  if (!h) return notify({ state: "off", folder: "" });
  const ok = await permission(h, false);
  notify({ state: ok ? "ready" : "needs-permission", folder: h.name });
}

// ── running one ────────────────────────────────────────────────────────────

// Cheap fingerprint of the whole library, so an unchanged workspace doesn't
// get written again every interval.
async function signature(): Promise<string> {
  const all = await loadAllProjects();
  let newest = 0;
  for (const p of all) newest = Math.max(newest, p.updatedAt || 0);
  return `${all.length}:${newest}`;
}

async function rotate(dir: DirHandle, keep: number): Promise<void> {
  const names: string[] = [];
  for await (const [name, entry] of dir.entries()) {
    if (entry.kind === "file" && name.startsWith(PREFIX) && name.endsWith(".zip")) {
      names.push(name);
    }
  }
  // The timestamp in the name sorts chronologically as text.
  names.sort();
  for (const name of names.slice(0, Math.max(0, names.length - keep))) {
    try {
      await dir.removeEntry(name);
    } catch {
      /* leave it — a stale file is better than a failed backup */
    }
  }
}

const stamp = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(
    d.getMinutes(),
  ).padStart(2, "0")}`;

let inFlight: Promise<boolean> | null = null;

/**
 * Writes one backup. `force` ignores the interval, `ask` allows a permission
 * prompt (only pass it from a user gesture). Resolves true when a file was
 * written.
 */
export async function runBackup(
  { force = false, ask = false } = {},
): Promise<boolean> {
  if (inFlight) return inFlight;
  inFlight = (async () => {
    const settings = getSettings();
    if (!isSupported()) return false;
    if (!force && !settings.enabled) return false;

    const h = await handle();
    if (!h) {
      notify({ state: "off", folder: "" });
      return false;
    }
    if (!force && Date.now() - lastBackupAt() < settings.everyMin * 60_000) {
      return false;
    }
    if (!(await permission(h, ask))) {
      notify({ state: "needs-permission", folder: h.name });
      return false;
    }

    const sig = await signature();
    if (!force && sig === ls.get(LAST_SIG)) {
      // Nothing changed since the last one — don't write a duplicate, but do
      // count it as "backed up now" so the staleness nag stays quiet.
      ls.set(LAST_AT, String(Date.now()));
      notify({ state: "ready", folder: h.name, lastError: "" });
      return false;
    }

    notify({ running: true, lastError: "" });
    try {
      const { blob } = await exportBackup();
      const name = `${PREFIX}${stamp(new Date())}.zip`;
      const file = await h.getFileHandle(name, { create: true });
      const w = await file.createWritable();
      await w.write(blob);
      await w.close();
      await rotate(h, settings.keep);
      ls.set(LAST_AT, String(Date.now()));
      ls.set(LAST_SIG, sig);
      notify({ state: "ready", folder: h.name, running: false, lastError: "" });
      return true;
    } catch (e) {
      notify({ running: false, lastError: (e as Error).message });
      return false;
    }
  })();
  try {
    return await inFlight;
  } finally {
    inFlight = null;
  }
}

/** Boot: pick the status up and start the periodic check. */
export function startAutoBackup(): void {
  if (!isSupported()) return;
  void refreshStatus().then(() => void runBackup());
  // Checking often is cheap — runBackup bails on the interval and on an
  // unchanged signature long before it builds a zip.
  window.setInterval(() => void runBackup(), 2 * 60_000);
  // A last chance when the tab goes away.
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void runBackup();
  });
}
