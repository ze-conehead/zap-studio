// Shared helpers for inserting a cover into a game's sticker design as its
// main image — creating the design first if it doesn't exist yet — used by
// the game-tree context menu and by CoverSweepDialog's per-game walk
// through every card that has no image.

import { getCatalog, gameKeyOf } from "./data/catalog";
import { fitImageToMask, makeImageLayer, newProject } from "./factory";
import { getGameProject, linkGameProject } from "./gameIndex";
import { t } from "./i18n";
import { urlToLayerSource } from "./image";
import { loadAllProjects, loadProject, saveProject } from "./persist";
import { loadMainMask } from "./templates";
import type { Layer } from "./types";

export interface QuickImportRow {
  gameKey: string;
  consoleName: string;
  gameTitle: string;
}

const hasImageLayer = (layers: { type: string }[]) =>
  layers.some((l) => l.type === "image");

// gameKeys whose linked sticker design has at least one image layer.
// (Reads IndexedDB, so it can lag the live editor by one autosave — callers
// that care about the currently-open design should overlay its state.)
export async function loadImagedGameKeys(): Promise<Set<string>> {
  const projects = await loadAllProjects();
  const byId = new Map(projects.map((p) => [p.id, p]));
  const imaged = new Set<string>();
  for (const c of getCatalog()) {
    for (const g of c.games) {
      const gameKey = gameKeyOf(c, g);
      const pid = getGameProject(gameKey);
      const proj = pid ? byId.get(pid) : undefined;
      if (proj && hasImageLayer(proj.layers)) imaged.add(gameKey);
    }
  }
  return imaged;
}

// Every catalogue game whose linked design has no image layer (or has no
// design at all). `consoleId` limits it to one console; `excludeGameKey`
// drops one game (e.g. the design currently open in the editor).
export async function findGamesWithoutImage(
  opts: { consoleId?: string; excludeGameKey?: string } = {},
): Promise<QuickImportRow[]> {
  const imaged = await loadImagedGameKeys();
  const rows: QuickImportRow[] = [];
  for (const c of getCatalog()) {
    if (opts.consoleId && c.id !== opts.consoleId) continue;
    for (const g of c.games) {
      const gameKey = gameKeyOf(c, g);
      if (gameKey === opts.excludeGameKey) continue;
      if (!imaged.has(gameKey)) {
        rows.push({ gameKey, consoleName: c.name, gameTitle: g.title });
      }
    }
  }
  return rows;
}

// Fetches `url`, embeds it and adds it as the main image of `row`'s design
// on disk — creating and linking the design if it doesn't exist yet. Throws
// on a failed fetch (CORS, 404, not an image).
export async function insertCover(
  row: QuickImportRow,
  url: string,
): Promise<void> {
  const img = await urlToLayerSource(url);
  const layer = fitImageToMask(
    { ...makeImageLayer({ ...img, name: t("Main image") }), main: true },
    await loadMainMask(),
  );
  const pid = getGameProject(row.gameKey);
  const existing = pid ? await loadProject(pid) : undefined;
  if (existing) {
    await saveProject({
      ...existing,
      layers: [...existing.layers.map((l) => ({ ...l, main: false })), layer],
      updatedAt: Date.now(),
    });
  } else {
    const p = newProject(row.gameTitle);
    p.gameKey = row.gameKey;
    p.consoleName = row.consoleName;
    p.layers = [layer];
    linkGameProject(row.gameKey, p.id);
    await saveProject(p);
  }
}

// Fetches every picture in `items`, fits each into its alpha mask (frame) and
// adds them all to `row`'s design on disk in one save — creating and linking
// the design if it doesn't exist yet. A picture that can't be fetched is
// skipped; the ones that worked are still saved. Returns which mask got which
// new layer.
export async function insertMaskImages(
  row: QuickImportRow,
  items: { url: string; mask: Layer; name: string }[],
): Promise<{ mask: Layer; layerId: string }[]> {
  const layers = [];
  const filled: { mask: Layer; layerId: string }[] = [];
  for (const it of items) {
    try {
      const img = await urlToLayerSource(it.url);
      const layer = fitImageToMask(
        { ...makeImageLayer({ ...img, name: it.name }), maskId: it.mask.id },
        it.mask,
      );
      layers.push(layer);
      filled.push({ mask: it.mask, layerId: layer.id });
    } catch {
      /* one bad URL shouldn't lose the rest */
    }
  }
  if (!layers.length) return [];
  const pid = getGameProject(row.gameKey);
  const existing = pid ? await loadProject(pid) : undefined;
  if (existing) {
    await saveProject({ ...existing, layers: [...existing.layers, ...layers], updatedAt: Date.now() });
  } else {
    const p = newProject(row.gameTitle);
    p.gameKey = row.gameKey;
    p.consoleName = row.consoleName;
    p.layers = layers;
    linkGameProject(row.gameKey, p.id);
    await saveProject(p);
  }
  return filled;
}

// Swaps the picture of one image layer in a game's design on disk for `url`,
// re-fitted into `mask` from the new picture's own size (any crop dropped).
export async function replaceGameImage(
  gameKey: string,
  layerId: string,
  url: string,
  mask: Layer | undefined,
): Promise<void> {
  const pid = getGameProject(gameKey);
  const p = pid ? await loadProject(pid) : undefined;
  const old = p?.layers.find((l) => l.id === layerId);
  if (!p || old?.type !== "image") throw new Error(t("That image is no longer there."));
  const img = await urlToLayerSource(url);
  const fresh = makeImageLayer({ ...img, name: old.name });
  const next = fitImageToMask(
    { ...old, ...img, width: fresh.width, height: fresh.height, crop: undefined },
    mask,
  );
  await saveProject({
    ...p,
    layers: p.layers.map((l) => (l.id === layerId ? next : l)),
    updatedAt: Date.now(),
  });
}

/** Drops one layer from a game's design on disk. */
export async function removeGameLayer(gameKey: string, layerId: string): Promise<void> {
  const pid = getGameProject(gameKey);
  const p = pid ? await loadProject(pid) : undefined;
  if (!p) return;
  await saveProject({ ...p, layers: p.layers.filter((l) => l.id !== layerId), updatedAt: Date.now() });
}
