// User-uploaded font files (TTF/OTF/WOFF/WOFF2). Each one is registered as a
// real FontFace so it renders in the editor, in Konva exports (via canvas
// text) and in the font picker — right alongside the built-in list in
// fonts.ts. Stored per workspace in IndexedDB: font files run a few hundred
// KB to a few MB, too big for localStorage. An in-memory cache keeps reads
// synchronous for the picker via useSyncExternalStore.

import { del, get, keys, set } from "idb-keyval";
import { t } from "./i18n";
import { wsIdbPrefix } from "./workspace";

export interface CustomFont {
  id: string;
  name: string; // label shown in the picker — from the uploaded filename
  family: string; // the CSS font-family it's registered under (unique)
  dataUrl: string;
  addedAt: number;
}

const PREFIX = () => `${wsIdbPrefix()}font:`;
const KEY = (id: string) => `${PREFIX()}${id}`;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB — generous for a font file
const EXT_RE = /\.(ttf|otf|woff2?)$/i;

let cache: CustomFont[] = [];
let version = 0;
const listeners = new Set<() => void>();

function notify() {
  version++;
  for (const l of listeners) l();
}

export function subscribeCustomFonts(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getCustomFontsVersion(): number {
  return version;
}

/** Synchronous snapshot — empty until ensureCustomFontsLoaded() resolves. */
export function listCustomFonts(): CustomFont[] {
  return cache;
}

async function registerFace(f: CustomFont): Promise<void> {
  try {
    const face = new FontFace(f.family, `url("${f.dataUrl}")`);
    await face.load();
    (document.fonts as FontFaceSet).add(face);
  } catch {
    /* unusable font file — still listed, it just won't render */
  }
}

let initPromise: Promise<void> | null = null;

/** Loads every stored font once, registering each as a FontFace. Safe to
 * call repeatedly — later calls await the same load. */
export function ensureCustomFontsLoaded(): Promise<void> {
  if (!initPromise) {
    initPromise = (async () => {
      const prefix = PREFIX();
      let ids: string[] = [];
      try {
        ids = ((await keys()) as string[]).filter(
          (k) => typeof k === "string" && k.startsWith(prefix),
        );
      } catch {
        ids = [];
      }
      const fonts: CustomFont[] = [];
      for (const k of ids) {
        try {
          const f = (await get(k)) as CustomFont | undefined;
          if (f) fonts.push(f);
        } catch {
          /* skip an unreadable row */
        }
      }
      fonts.sort((a, b) => a.addedAt - b.addedAt);
      await Promise.all(fonts.map(registerFace));
      cache = fonts;
      notify();
    })();
  }
  return initPromise;
}

function uniqueFamily(name: string): string {
  const base = `Custom ${name.replace(/[^A-Za-z0-9 _-]/g, "").trim() || "Font"}`;
  const used = new Set(cache.map((f) => f.family));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base} ${n}`)) n++;
  return `${base} ${n}`;
}

/** Reads, registers and persists an uploaded font file. */
export async function addCustomFont(file: File): Promise<CustomFont> {
  if (!EXT_RE.test(file.name)) {
    throw new Error(t("That doesn't look like a font file (.ttf, .otf, .woff, .woff2)."));
  }
  if (file.size > MAX_BYTES) {
    throw new Error(t("That font file is too big (max {n} MB).", { n: 10 }));
  }
  await ensureCustomFontsLoaded();

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(new Error(t("Couldn't read that file.")));
    r.readAsDataURL(file);
  });

  return persistFont(file.name.replace(/\.[^.]+$/, ""), dataUrl);
}

async function persistFont(name: string, dataUrl: string): Promise<CustomFont> {
  const font: CustomFont = {
    id: crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name,
    family: uniqueFamily(name),
    dataUrl,
    addedAt: Date.now(),
  };
  await registerFace(font);
  await set(KEY(font.id), font);
  cache = [...cache, font];
  notify();
  return font;
}

/** Restores a font from a full-backup entry. Keeps the backup's id/family so
 * re-importing the same backup overwrites the same row instead of piling up
 * duplicates. */
export async function importCustomFont(f: CustomFont): Promise<void> {
  await ensureCustomFontsLoaded();
  await registerFace(f);
  await set(KEY(f.id), f);
  cache = [...cache.filter((x) => x.id !== f.id), f];
  notify();
}

export async function removeCustomFont(id: string): Promise<void> {
  await del(KEY(id));
  cache = cache.filter((f) => f.id !== id);
  notify();
}
