// "Quick Import": a table of every game that still has no image, one row
// per game with a URL field. On confirm, each URL is fetched, embedded and
// added as an image layer to that game's sticker design (creating the
// design if it doesn't exist yet) — the bulk version of "Cover suchen".

import { TRIM_RECT } from "./card";
import { getCatalog, gameKeyOf } from "./data/catalog";
import { makeImageLayer, makeTextLayer, newProject } from "./factory";
import { getGameProject, linkGameProject } from "./gameIndex";
import { urlToLayerSource } from "./image";
import { loadAllProjects, loadProject, saveProject } from "./persist";
import type { ImageLayer } from "./types";

export interface QuickImportRow {
  gameKey: string;
  consoleName: string;
  gameTitle: string;
}

export interface QuickImportResult extends QuickImportRow {
  ok: boolean;
  error?: string;
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
// design at all).
export async function findGamesWithoutImage(): Promise<QuickImportRow[]> {
  const imaged = await loadImagedGameKeys();
  const rows: QuickImportRow[] = [];
  for (const c of getCatalog()) {
    for (const g of c.games) {
      const gameKey = gameKeyOf(c, g);
      if (!imaged.has(gameKey)) {
        rows.push({ gameKey, consoleName: c.name, gameTitle: g.title });
      }
    }
  }
  return rows;
}

interface ApplyOptions {
  // The gameKey of the design currently open in the editor, if any. Its row
  // is handed back through `addToCurrent` so the live store stays in sync
  // instead of being overwritten on disk.
  currentGameKey?: string;
  addToCurrent: (layer: ImageLayer) => void;
  onProgress?: (done: number, total: number) => void;
}

function titleLayer(gameTitle: string) {
  return {
    ...makeTextLayer(gameTitle),
    name: gameTitle,
    y: TRIM_RECT.y + TRIM_RECT.h * 0.16,
    width: TRIM_RECT.w * 0.86,
    fontSize: 40,
  };
}

// Fetches every row's URL and adds it as an image layer to that game's
// design. Rows are processed one by one; a failed fetch (CORS, 404, not an
// image) is recorded and the rest continue.
export async function applyQuickImport(
  entries: (QuickImportRow & { url: string })[],
  { currentGameKey, addToCurrent, onProgress }: ApplyOptions,
): Promise<QuickImportResult[]> {
  const results: QuickImportResult[] = [];
  for (const e of entries) {
    try {
      const img = await urlToLayerSource(e.url);
      const layer: ImageLayer = {
        ...makeImageLayer({ ...img, name: e.gameTitle }),
        main: true,
      };

      if (e.gameKey === currentGameKey) {
        addToCurrent(layer);
      } else {
        const pid = getGameProject(e.gameKey);
        const existing = pid ? await loadProject(pid) : undefined;
        if (existing) {
          await saveProject({
            ...existing,
            layers: [
              ...existing.layers.map((l) => ({ ...l, main: false })),
              layer,
            ],
            updatedAt: Date.now(),
          });
        } else {
          const p = newProject(e.gameTitle);
          p.gameKey = e.gameKey;
          p.consoleName = e.consoleName;
          p.layers = [titleLayer(e.gameTitle), layer];
          linkGameProject(e.gameKey, p.id);
          await saveProject(p);
        }
      }
      results.push({ ...e, ok: true });
    } catch (err) {
      results.push({ ...e, ok: false, error: (err as Error).message });
    }
    onProgress?.(results.length, entries.length);
  }
  return results;
}
