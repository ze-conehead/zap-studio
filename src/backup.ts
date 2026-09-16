import { t } from "./i18n";
import { set } from "idb-keyval";
import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import {
  ensureCustomFontsLoaded,
  importCustomFont,
  listCustomFonts,
  type CustomFont,
} from "./customFonts";
import { getIgdbCreds, getSgdbKey, getTmdbKey, setIgdbCreds, setSgdbKey, setTmdbKey } from "./covers";
import { loadAllProjects } from "./persist";
import { getWorkspaceKind, setWorkspaceKind, wsIdbPrefix, wsSuffix, type WorkspaceKind } from "./workspace";
import { localCovers, localLogos, type ImageLibrary, type LocalLogo } from "./localLogos";
import type { Project } from "./types";

// Full backup: every project + every template + the workspace's settings
// (guides, game index, catalogue edits, gamelists, format / custom format /
// bleed, kind) and the local cover / logo libraries, with images stored
// as real files and deduplicated.

const BACKUP_FORMAT = "credit-card-sticker-studio-backup";
// A backup covers the active workspace only — its projects and its settings.
const GUIDES_KEY = `stickerstudio:guides${wsSuffix()}`;
const GAME_INDEX_KEY = "stickerstudio:gameIndex";
const CATALOG_OVERLAY_KEY = `stickerstudio:catalogOverlay${wsSuffix()}`;
const GAMELIST_PREFIX = "stickerstudio:gamelist:";
// Off by default — API keys are secrets, so a backup only carries them
// along when the user explicitly opts in (Data safety ▸ "Include API
// keys"). Global, not per-workspace: the keys themselves aren't either.
const INCLUDE_KEYS_KEY = "stickerstudio:backupIncludeKeys";
export const getIncludeKeysInBackup = (): boolean =>
  localStorage.getItem(INCLUDE_KEYS_KEY) === "1";
export function setIncludeKeysInBackup(v: boolean): void {
  if (v) localStorage.setItem(INCLUDE_KEYS_KEY, "1");
  else localStorage.removeItem(INCLUDE_KEYS_KEY);
}
// Plain per-workspace keys copied verbatim: format, custom size, bleed.
const SETTING_KEYS = ["stickerstudio:format", "stickerstudio:customFormat", "stickerstudio:bleed"];
const wsKey = (base: string) => `${base}${wsSuffix()}`;
// A key belongs to this workspace when it carries its suffix — the
// original workspace's keys carry none, so "--w" must be absent there.
const mine = (k: string) => (wsSuffix() ? k.endsWith(wsSuffix()) : !k.includes("--w"));

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
  await ensureCustomFontsLoaded();
  const fonts = listCustomFonts();
  const files: Record<string, Uint8Array> = {};
  const assetMime: Record<string, string> = {};
  const seen = new Map<string, string>(); // data URL -> "asset:<file>"

  const externalizeLayer = <T extends Project["layers"][number]>(l: T): T => {
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
  };

  const externalize = (p: Project): Project => ({
    ...p,
    layers: p.layers.map(externalizeLayer),
    ...(p.back && {
      back: { ...p.back, layers: p.back.layers.map(externalizeLayer) },
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
  const catalogOverlay = localStorage.getItem(CATALOG_OVERLAY_KEY);
  if (guides) files["settings/guides.json"] = strToU8(guides);
  if (catalogOverlay) files["settings/catalogOverlay.json"] = strToU8(catalogOverlay);

  // One game index per format (GAME_INDEX_KEY plus "…:<format>" variants).
  const gameIndexes: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    // `endsWith("")` matches everything, so the original workspace has to
    // exclude the other workspaces' suffixed keys explicitly.
    const mine = wsSuffix() ? k?.endsWith(wsSuffix()) : !k?.includes("--w");
    if (k && k.startsWith(GAME_INDEX_KEY) && mine) {
      gameIndexes[k] = localStorage.getItem(k) ?? "";
    }
  }
  if (Object.keys(gameIndexes).length) {
    files["settings/gameIndexes.json"] = strToU8(JSON.stringify(gameIndexes));
  }

  for (const f of fonts) {
    files[`fonts/${f.id}.json`] = strToU8(JSON.stringify(f));
  }

  // Metadata per console, the format settings and the workspace kind.
  const gamelists: Record<string, string> = {};
  const settings: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !mine(k)) continue;
    if (k.startsWith(GAMELIST_PREFIX)) {
      // Stored without the suffix, so it lands in whichever workspace imports it.
      gamelists[k.slice(GAMELIST_PREFIX.length, k.length - wsSuffix().length)] = localStorage.getItem(k) ?? "";
    }
  }
  for (const base of SETTING_KEYS) {
    const v = localStorage.getItem(wsKey(base));
    if (v !== null) settings[base] = v;
  }
  if (Object.keys(gamelists).length) files["settings/gamelists.json"] = strToU8(JSON.stringify(gamelists));
  files["settings/workspace.json"] = strToU8(JSON.stringify({ kind: getWorkspaceKind(), settings }));

  // The local cover / logo libraries: one file per image plus an index.
  const libraries: Record<string, LocalLogo[]> = {};
  for (const lib of [localLogos, localCovers]) {
    await lib.ensureLoaded();
    const entries = lib.list();
    if (!entries.length) continue;
    libraries[lib.kind] = entries;
    for (const e of entries) {
      const url = await lib.url(e.id);
      if (!url) continue;
      const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());
      files[`${lib.kind}s/${e.id}.${MIME_EXT[e.type] ?? "bin"}`] = bytes;
    }
  }
  if (Object.keys(libraries).length) files["settings/libraries.json"] = strToU8(JSON.stringify(libraries));

  // API keys: only when the user opted in — see getIncludeKeysInBackup().
  // They land in the zip as plain text, so a synced/shared backup folder
  // would expose them; the manifest flags it either way.
  const includesKeys = getIncludeKeysInBackup();
  if (includesKeys) {
    const creds = getIgdbCreds();
    files["settings/keys.json"] = strToU8(
      JSON.stringify({
        sgdbKey: getSgdbKey(),
        igdbClientId: creds.clientId,
        igdbClientSecret: creds.clientSecret,
        tmdbKey: getTmdbKey(),
      }),
    );
  }

  files["manifest.json"] = strToU8(
    JSON.stringify(
      {
        format: BACKUP_FORMAT,
        version: 1,
        exportedAt: new Date().toISOString(),
        projects: np,
        templates: nt,
        fonts: fonts.length,
        libraries: Object.fromEntries(Object.entries(libraries).map(([k, v]) => [k, v.length])),
        includesApiKeys: includesKeys,
        assets: assetMime,
      },
      null,
      2,
    ),
  );

  const zipped = zipSync(files, { level: 6 });
  return {
    blob: new Blob([zipped], { type: "application/zip" }),
    name: `zap-studio-backup_${new Date().toISOString().slice(0, 10)}.zip`,
  };
}

export async function importBackup(
  file: File,
): Promise<{ projects: number; templates: number; includesApiKeys: boolean }> {
  const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));

  const manifestRaw = entries["manifest.json"];
  if (!manifestRaw) throw new Error(t("Not a valid backup file (manifest.json missing)."));
  const manifest = JSON.parse(strFromU8(manifestRaw)) as {
    format?: string;
    assets?: Record<string, string>;
    includesApiKeys?: boolean;
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

  const resolveLayer = <T extends Project["layers"][number]>(l: T): T =>
    l.type === "image" && l.src.startsWith("asset:")
      ? { ...l, src: assetUrl.get(l.src) ?? l.src }
      : l;

  const resolve = (p: Project): Project => ({
    ...p,
    layers: p.layers.map(resolveLayer),
    ...(p.back && { back: { ...p.back, layers: p.back.layers.map(resolveLayer) } }),
  });

  let np = 0;
  let nt = 0;
  for (const path of Object.keys(entries)) {
    if (!/^(projects|templates)\/.+\.json$/.test(path)) continue;
    const proj = resolve(JSON.parse(strFromU8(entries[path])) as Project);
    if (!proj.id) continue;
    await set(`${wsIdbPrefix()}project:${proj.id}`, proj);
    if (proj.isTemplate) nt++;
    else np++;
  }

  for (const path of Object.keys(entries)) {
    if (!/^fonts\/.+\.json$/.test(path)) continue;
    try {
      const font = JSON.parse(strFromU8(entries[path])) as CustomFont;
      if (font.id && font.family && font.dataUrl) await importCustomFont(font);
    } catch {
      /* skip an unreadable font entry */
    }
  }

  if (entries["settings/guides.json"]) {
    localStorage.setItem(GUIDES_KEY, strFromU8(entries["settings/guides.json"]));
  }
  const mergeGameIndex = (lsKey: string, incomingJson: string) => {
    try {
      const incoming = JSON.parse(incomingJson);
      const existing = JSON.parse(localStorage.getItem(lsKey) || "{}");
      localStorage.setItem(lsKey, JSON.stringify({ ...existing, ...incoming }));
    } catch {
      /* keep existing index */
    }
  };
  if (entries["settings/gameIndexes.json"]) {
    try {
      const byKey = JSON.parse(strFromU8(entries["settings/gameIndexes.json"])) as Record<
        string,
        string
      >;
      for (const [lsKey, json] of Object.entries(byKey)) mergeGameIndex(lsKey, json);
    } catch {
      /* skip */
    }
  } else if (entries["settings/gameIndex.json"]) {
    // Older backups: a single card-format index.
    mergeGameIndex(GAME_INDEX_KEY, strFromU8(entries["settings/gameIndex.json"]));
  }
  if (entries["settings/catalogOverlay.json"]) {
    localStorage.setItem(
      CATALOG_OVERLAY_KEY,
      strFromU8(entries["settings/catalogOverlay.json"]),
    );
  }

  if (entries["settings/gamelists.json"]) {
    try {
      const lists = JSON.parse(strFromU8(entries["settings/gamelists.json"])) as Record<string, string>;
      for (const [consoleId, json] of Object.entries(lists)) {
        localStorage.setItem(`${GAMELIST_PREFIX}${consoleId}${wsSuffix()}`, json);
      }
    } catch {
      /* skip */
    }
  }
  if (entries["settings/workspace.json"]) {
    try {
      const ws = JSON.parse(strFromU8(entries["settings/workspace.json"])) as {
        kind?: WorkspaceKind;
        settings?: Record<string, string>;
      };
      if (ws.kind === "games" || ws.kind === "movies") setWorkspaceKind(ws.kind);
      for (const base of SETTING_KEYS) {
        const v = ws.settings?.[base];
        if (v === undefined) localStorage.removeItem(wsKey(base));
        else localStorage.setItem(wsKey(base), v);
      }
    } catch {
      /* skip */
    }
  }

  // Libraries: entries with the same folder + name replace what's there.
  if (entries["settings/libraries.json"]) {
    try {
      const libraries = JSON.parse(strFromU8(entries["settings/libraries.json"])) as Record<string, LocalLogo[]>;
      for (const lib of [localLogos, localCovers] as ImageLibrary[]) {
        const list = libraries[lib.kind];
        if (!list?.length) continue;
        const inputs = [];
        for (const e of list) {
          const path = `${lib.kind}s/${e.id}.${MIME_EXT[e.type] ?? "bin"}`;
          const bytes = entries[path];
          if (!bytes) continue;
          inputs.push({
            file: new Blob([bytes as BlobPart], { type: e.type }),
            name: `${e.name}.${MIME_EXT[e.type] ?? "png"}`,
            path: e.path,
          });
        }
        if (inputs.length) await lib.add(inputs);
      }
    } catch (e) {
      console.error("library import failed", e);
    }
  }

  // API keys: only present when the backup's author opted in at export
  // time (see getIncludeKeysInBackup()) — restoring one then carries them
  // over here too, the same as every other setting.
  if (entries["settings/keys.json"]) {
    try {
      const keys = JSON.parse(strFromU8(entries["settings/keys.json"])) as {
        sgdbKey?: string;
        igdbClientId?: string;
        igdbClientSecret?: string;
        tmdbKey?: string;
      };
      if (keys.sgdbKey) setSgdbKey(keys.sgdbKey);
      if (keys.tmdbKey) setTmdbKey(keys.tmdbKey);
      if (keys.igdbClientId || keys.igdbClientSecret) {
        setIgdbCreds(keys.igdbClientId ?? "", keys.igdbClientSecret ?? "");
      }
    } catch {
      /* skip */
    }
  }

  return { projects: np, templates: nt, includesApiKeys: !!manifest.includesApiKeys };
}
