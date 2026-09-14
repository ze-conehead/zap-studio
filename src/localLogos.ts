// The user's own logo library — "Settings ▸ Manage logos …". Files dropped
// in one by one, as whole folders, or as a .zip (nested folders welcome)
// land in IndexedDB as Blobs; with "Logo source: Local" the logo search
// looks them up by file name instead of asking SteamGridDB. Shared by every
// workspace: a console's wordmark is the same in every project.

import { del, get, keys, set } from "idb-keyval";
import { unzipSync } from "fflate";
import { normalizeTitle, type CoverCandidate } from "./covers";
import { t } from "./i18n";

export interface LocalLogo {
  id: string;
  name: string; // file name without extension — what the search matches
  path: string; // folder path inside the drop / zip, "" at the top level
  type: string; // image MIME type
  size: number; // bytes
  addedAt: number;
}

const INDEX_KEY = "localLogos:index";
const BLOB_KEY = (id: string) => `localLogo:${id}`;

const MAX_BYTES = 8 * 1024 * 1024; // per file
const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  bmp: "image/bmp",
  avif: "image/avif",
};

const ext = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";
const isImageName = (name: string) => !!EXT_MIME[ext(name)];
// Finder / zip cruft that never is a logo.
const isJunk = (path: string) =>
  path.split("/").some((seg) => seg === "__MACOSX" || seg.startsWith(".") || seg === "Thumbs.db");

let cache: LocalLogo[] | null = null;
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version++;
  for (const l of listeners) l();
}

export function subscribeLocalLogos(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getLocalLogosVersion(): number {
  return version;
}

/** Synchronous snapshot — empty until ensureLocalLogosLoaded() resolves. */
export function listLocalLogos(): LocalLogo[] {
  return cache ?? [];
}

let initPromise: Promise<void> | null = null;

export function ensureLocalLogosLoaded(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      cache = ((await get(INDEX_KEY)) as LocalLogo[] | undefined) ?? [];
      notify();
    })().catch(() => {
      cache = [];
    });
  }
  return initPromise;
}

async function saveIndex(next: LocalLogo[]): Promise<void> {
  cache = next;
  await set(INDEX_KEY, next);
  notify();
}

const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

// One object URL per blob, made when first shown and kept for the session —
// the search results and the manage grid both point at these.
const urls = new Map<string, string>();

export async function localLogoUrl(id: string): Promise<string | undefined> {
  const cached = urls.get(id);
  if (cached) return cached;
  const blob = (await get(BLOB_KEY(id))) as Blob | undefined;
  if (!blob) return undefined;
  const url = URL.createObjectURL(blob);
  urls.set(id, url);
  return url;
}

// ── adding ─────────────────────────────────────────────────────────────────

export interface AddedLogo {
  file: Blob;
  name: string; // file name with extension
  path: string; // folder path, "" at top level
}

export interface AddReport {
  added: number;
  replaced: number;
  skipped: number; // not an image, too large, or zip cruft
}

/** Stores images (replacing any with the same path + name); unpacks zips. */
export async function addLocalLogos(
  inputs: AddedLogo[],
  onProgress?: (done: number, total: number) => void,
): Promise<AddReport> {
  await ensureLocalLogosLoaded();
  // Expand zips first so progress counts real files.
  const flat: AddedLogo[] = [];
  for (const input of inputs) {
    if (ext(input.name) === "zip") {
      flat.push(...(await unpackZip(input)));
    } else {
      flat.push(input);
    }
  }

  const report: AddReport = { added: 0, replaced: 0, skipped: 0 };
  const next = [...(cache ?? [])];
  let done = 0;
  for (const f of flat) {
    done++;
    onProgress?.(done, flat.length);
    const full = f.path ? `${f.path}/${f.name}` : f.name;
    if (!isImageName(f.name) || isJunk(full) || f.file.size > MAX_BYTES || f.file.size === 0) {
      report.skipped++;
      continue;
    }
    const type = f.file.type?.startsWith("image/") ? f.file.type : EXT_MIME[ext(f.name)];
    const blob = f.file.type === type ? f.file : new Blob([f.file], { type });
    const name = f.name.replace(/\.[^.]+$/, "");
    const existing = next.findIndex((l) => l.path === f.path && l.name === name);
    const id = existing >= 0 ? next[existing].id : newId();
    await set(BLOB_KEY(id), blob);
    const entry: LocalLogo = { id, name, path: f.path, type, size: blob.size, addedAt: Date.now() };
    if (existing >= 0) {
      next[existing] = entry;
      report.replaced++;
      const old = urls.get(id);
      if (old) {
        URL.revokeObjectURL(old);
        urls.delete(id);
      }
    } else {
      next.push(entry);
      report.added++;
    }
  }
  await saveIndex(next);
  return report;
}

async function unpackZip(input: AddedLogo): Promise<AddedLogo[]> {
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(await input.file.arrayBuffer()));
  } catch {
    throw new Error(t("“{name}” is not a readable .zip file.", { name: input.name }));
  }
  const out: AddedLogo[] = [];
  for (const [entryPath, bytes] of Object.entries(entries)) {
    if (entryPath.endsWith("/") || !bytes.length) continue; // folder entry
    if (isJunk(entryPath) || !isImageName(entryPath)) continue;
    const parts = entryPath.split("/");
    const name = parts.pop()!;
    const zipStem = input.name.replace(/\.[^.]+$/, "");
    const folder = [input.path, zipStem, ...parts].filter(Boolean).join("/");
    out.push({
      file: new Blob([bytes as BlobPart], { type: EXT_MIME[ext(name)] }),
      name,
      path: folder,
    });
  }
  return out;
}

/** Turns a DataTransfer (drop) into logos, walking dropped folders. */
export async function logosFromDataTransfer(dt: DataTransfer): Promise<AddedLogo[]> {
  const out: AddedLogo[] = [];
  const items = [...(dt.items ?? [])];
  const entries = items
    .map((it) => (typeof it.webkitGetAsEntry === "function" ? it.webkitGetAsEntry() : null))
    .filter((e): e is FileSystemEntry => !!e);
  if (entries.length) {
    for (const e of entries) await walkEntry(e, "", out);
    return out;
  }
  for (const f of [...dt.files]) out.push({ file: f, name: f.name, path: "" });
  return out;
}

/** Files from an <input type="file"> — a folder pick keeps its paths. */
export function logosFromFileList(files: FileList | File[]): AddedLogo[] {
  return [...files].map((f) => {
    const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || "";
    const parts = rel.split("/");
    parts.pop();
    return { file: f, name: f.name, path: parts.join("/") };
  });
}

async function walkEntry(entry: FileSystemEntry, path: string, out: AddedLogo[]): Promise<void> {
  if (entry.isFile) {
    const file = await new Promise<File>((res, rej) =>
      (entry as FileSystemFileEntry).file(res, rej),
    );
    out.push({ file, name: file.name, path });
    return;
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const sub = path ? `${path}/${entry.name}` : entry.name;
    // readEntries returns in batches until an empty one.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej));
      if (!batch.length) break;
      for (const e of batch) await walkEntry(e, sub, out);
    }
  }
}

// ── removing ───────────────────────────────────────────────────────────────

export async function removeLocalLogo(id: string): Promise<void> {
  await ensureLocalLogosLoaded();
  await del(BLOB_KEY(id));
  const url = urls.get(id);
  if (url) {
    URL.revokeObjectURL(url);
    urls.delete(id);
  }
  await saveIndex((cache ?? []).filter((l) => l.id !== id));
}

export async function removeAllLocalLogos(): Promise<void> {
  const all = (await keys()).filter((k) => typeof k === "string" && k.startsWith("localLogo:"));
  for (const k of all) await del(k);
  for (const url of urls.values()) URL.revokeObjectURL(url);
  urls.clear();
  await saveIndex([]);
}

// ── searching ──────────────────────────────────────────────────────────────

const tokens = (s: string) => normalizeTitle(s).split(" ").filter(Boolean);

// How well a stored logo fits a console name: exact file name first, then a
// file name that contains (or is contained in) the query, then by how many
// words they share — a folder named after the console counts a little too.
function score(logo: LocalLogo, q: string, qTokens: string[]): number {
  const stem = normalizeTitle(logo.name);
  if (!stem) return 0;
  let s = 0;
  if (stem === q) s = 100;
  else if (stem.includes(q)) s = 80;
  else if (q.includes(stem) && stem.length >= 3) s = 60;
  else {
    const st = tokens(logo.name);
    const shared = qTokens.filter((tk) => st.includes(tk)).length;
    if (shared) s = 20 + (40 * shared) / Math.max(qTokens.length, st.length);
  }
  const folder = normalizeTitle(logo.path.split("/").pop() ?? "");
  if (folder && (folder === q || qTokens.some((tk) => tk.length > 2 && folder.includes(tk)))) s += 10;
  return s;
}

export async function searchLocalLogos(term: string): Promise<CoverCandidate[]> {
  await ensureLocalLogosLoaded();
  const q = normalizeTitle(term);
  if (!q) return [];
  const qTokens = q.split(" ").filter(Boolean);
  const ranked = (cache ?? [])
    .map((l) => ({ l, s: score(l, q, qTokens) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.l.name.localeCompare(b.l.name))
    .slice(0, 48);
  const out: CoverCandidate[] = [];
  for (const { l } of ranked) {
    const url = await localLogoUrl(l.id);
    if (!url) continue;
    // The grid captions `region || title`: the file name is the useful bit.
    out.push({ title: l.name, region: "", url, thumb: url });
  }
  return out;
}
