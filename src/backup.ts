import { t } from "./i18n";
import { set } from "idb-keyval";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { loadAllProjects } from "./persist";
import type { Project } from "./types";

// Full backup: every project + every template + the global settings
// (guides, game index, catalogue edits), with images stored as real files
// and deduplicated.

const BACKUP_FORMAT = "credit-card-sticker-studio-backup";
const GUIDES_KEY = "stickerstudio:guides";
const GAME_INDEX_KEY = "stickerstudio:gameIndex";
const CATALOG_OVERLAY_KEY = "stickerstudio:catalogOverlay";

const MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
  "image/bmp": "bmp",
};
const EXT_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  svg: "image/svg+xml",
  avif: "image/avif",
  bmp: "image/bmp",
};

function hash(str: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(14, "0");
}

function parseDataUrl(url: string): { mime: string; ext: string; bytes: Uint8Array } | null {
  const m = /^data:([^,]*),([\s\S]*)$/.exec(url);
  if (!m) return null;
  const meta = m[1]; // e.g. "image/png;base64" or "image/svg+xml;charset=utf-8"
  const mime = meta.split(";")[0] || "application/octet-stream";
  const ext = MIME_EXT[mime] ?? "bin";
  if (/;base64\s*$/i.test(meta)) {
    const bin = atob(m[2]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return { mime, ext, bytes };
  }
  return { mime, ext, bytes: strToU8(decodeURIComponent(m[2])) };
}

function bytesToDataUrl(bytes: Uint8Array, mime: string): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return `data:${mime};base64,${btoa(bin)}`;
}

export async function exportBackup(): Promise<{ blob: Blob; name: string }> {
  const projects = await loadAllProjects();
  const files: Record<string, Uint8Array> = {};
  const assetMime: Record<string, string> = {};
  const seen = new Map<string, string>(); // data URL -> "asset:<file>"

  const externalize = (p: Project): Project => ({
    ...p,
    layers: p.layers.map((l) => {
      if (l.type !== "image" || !l.src.startsWith("data:")) return l;
      let ref = seen.get(l.src);
      if (!ref) {
        const parsed = parseDataUrl(l.src);
        if (!parsed) return l;
        const fname = `${hash(l.src)}.${parsed.ext}`;
        files[`assets/${fname}`] = parsed.bytes;
        assetMime[fname] = parsed.mime;
        ref = `asset:${fname}`;
        seen.set(l.src, ref);
      }
      return { ...l, src: ref };
    }),
  });

  let np = 0;
  let nt = 0;
  for (const p of projects) {
    const dir = p.isTemplate ? "templates" : "projects";
    files[`${dir}/${p.id}.json`] = strToU8(JSON.stringify(externalize(p), null, 2));
    if (p.isTemplate) nt++;
    else np++;
  }

  const guides = localStorage.getItem(GUIDES_KEY);
  const gameIndex = localStorage.getItem(GAME_INDEX_KEY);
  const catalogOverlay = localStorage.getItem(CATALOG_OVERLAY_KEY);
  if (guides) files["settings/guides.json"] = strToU8(guides);
  if (gameIndex) files["settings/gameIndex.json"] = strToU8(gameIndex);
  if (catalogOverlay) files["settings/catalogOverlay.json"] = strToU8(catalogOverlay);

  files["manifest.json"] = strToU8(
    JSON.stringify(
      {
        format: BACKUP_FORMAT,
        version: 1,
        exportedAt: new Date().toISOString(),
        projects: np,
        templates: nt,
        assets: assetMime,
      },
      null,
      2,
    ),
  );

  const zipped = zipSync(files, { level: 6 });
  return {
    blob: new Blob([zipped], { type: "application/zip" }),
    name: `sticker-studio-backup_${new Date().toISOString().slice(0, 10)}.zip`,
  };
}

export async function importBackup(file: File): Promise<{ projects: number; templates: number }> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));

  const manifestRaw = entries["manifest.json"];
  if (!manifestRaw) throw new Error(t("Not a valid backup file (manifest.json missing)."));
  const manifest = JSON.parse(strFromU8(manifestRaw)) as {
    format?: string;
    assets?: Record<string, string>;
  };
  if (manifest.format !== BACKUP_FORMAT) throw new Error(t("Unknown backup format."));

  const assetUrl = new Map<string, string>();
  for (const path of Object.keys(entries)) {
    if (!path.startsWith("assets/")) continue;
    const fname = path.slice("assets/".length);
    const ext = fname.split(".").pop() ?? "";
    const mime = manifest.assets?.[fname] ?? EXT_MIME[ext] ?? "application/octet-stream";
    assetUrl.set(`asset:${fname}`, bytesToDataUrl(entries[path], mime));
  }

  const resolve = (p: Project): Project => ({
    ...p,
    layers: p.layers.map((l) =>
      l.type === "image" && l.src.startsWith("asset:")
        ? { ...l, src: assetUrl.get(l.src) ?? l.src }
        : l,
    ),
  });

  let np = 0;
  let nt = 0;
  for (const path of Object.keys(entries)) {
    if (!/^(projects|templates)\/.+\.json$/.test(path)) continue;
    const proj = resolve(JSON.parse(strFromU8(entries[path])) as Project);
    if (!proj.id) continue;
    await set(`project:${proj.id}`, proj);
    if (proj.isTemplate) nt++;
    else np++;
  }

  if (entries["settings/guides.json"]) {
    localStorage.setItem(GUIDES_KEY, strFromU8(entries["settings/guides.json"]));
  }
  if (entries["settings/gameIndex.json"]) {
    try {
      const incoming = JSON.parse(strFromU8(entries["settings/gameIndex.json"]));
      const existing = JSON.parse(localStorage.getItem(GAME_INDEX_KEY) || "{}");
      localStorage.setItem(GAME_INDEX_KEY, JSON.stringify({ ...existing, ...incoming }));
    } catch {
      /* keep existing index */
    }
  }
  if (entries["settings/catalogOverlay.json"]) {
    localStorage.setItem(
      CATALOG_OVERLAY_KEY,
      strFromU8(entries["settings/catalogOverlay.json"]),
    );
  }

  return { projects: np, templates: nt };
}
