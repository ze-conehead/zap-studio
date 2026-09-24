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
