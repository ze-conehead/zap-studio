// "Demo mode": draws a booster pack of random game cards (one console or
// all of them), renders each design the same way the editor does and lets
// you flip through them in 3D. Nothing here writes to the project store.

import { TRIM_RECT } from "./card";
import { gameKeyOf, getCatalog } from "./data/catalog";
import {
  GLOBAL_TEMPLATE_ID,
  isBackground,
  makeTextLayer,
  newProject,
  templateId,
} from "./factory";
import { getGameProject } from "./gameIndex";
import { loadProject } from "./persist";
import type { CardBackground, Layer, Project } from "./types";

export const PACK_SIZE = 12;
export const HOLO_CHANCE = 0.1;

export interface DemoCard {
  key: string; // unique per pack slot (a small pool may repeat games)
  consoleName: string;
  gameTitle: string;
  project: Project;
  overlay: Layer[]; // console + global template layers
  consoleBg?: CardBackground;
  globalBg?: CardBackground;
  mainMask?: Layer;
  holo: boolean;
  image?: string; // filled in once the card has been rendered
}

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// A game without a saved design still gets a card, so a pack is never empty.
function placeholderProject(gameKey: string, consoleName: string, title: string): Project {
  const p = newProject(title);
  p.gameKey = gameKey;
  p.consoleName = consoleName;
  p.layers = [
    {
      ...makeTextLayer(title),
      name: title,
      y: TRIM_RECT.y + TRIM_RECT.h * 0.16,
      width: TRIM_RECT.w * 0.86,
      fontSize: 40,
    },
  ];
  return p;
}

// Draws `size` random cards. `consoleId` limits the pool to one console;
// undefined draws from every console. Pools smaller than a pack repeat.
export async function drawPack(
  consoleId: string | undefined,
  size = PACK_SIZE,
): Promise<DemoCard[]> {
  const catalog = getCatalog();
  const consoles = consoleId ? catalog.filter((c) => c.id === consoleId) : catalog;
  const pool = consoles.flatMap((c) => c.games.map((game) => ({ console: c, game })));
  if (!pool.length) return [];

  const picks: typeof pool = [];
  while (picks.length < size) picks.push(...shuffle(pool).slice(0, size - picks.length));

  const bgFill = (p?: Project) => {
    const bg = p?.layers.find(isBackground);
    return bg?.visible ? bg.fill : undefined;
  };
  const overlayable = (p?: Project) =>
    (p?.layers ?? []).filter((l) => !l.mainMask && !isBackground(l));

  const globalP = await loadProject(GLOBAL_TEMPLATE_ID);
  const globalBg = bgFill(globalP);
  const mainMask = globalP?.layers.find((l) => l.mainMask && l.visible);
  const globalLayers = overlayable(globalP);

  const tplCache = new Map<string, Project | undefined>();
  const cards: DemoCard[] = [];

  for (const [i, pick] of picks.entries()) {
    const gameKey = gameKeyOf(pick.console, pick.game);
    if (!tplCache.has(pick.console.id)) {
      tplCache.set(pick.console.id, await loadProject(templateId(pick.console.id)));
    }
    const consoleP = tplCache.get(pick.console.id);

    const pid = getGameProject(gameKey);
    const saved = pid ? await loadProject(pid) : undefined;

    cards.push({
      key: `${gameKey}#${i}`,
      consoleName: pick.console.name,
      gameTitle: pick.game.title,
      project:
        saved ?? placeholderProject(gameKey, pick.console.name, pick.game.title),
      overlay: [...overlayable(consoleP), ...globalLayers],
      consoleBg: bgFill(consoleP),
      globalBg,
      mainMask,
      holo: false,
    });
  }

  // One shiny card per pack, 10 % of the time.
  if (cards.length && Math.random() < HOLO_CHANCE) {
    cards[Math.floor(Math.random() * cards.length)].holo = true;
  }
  return cards;
}

// Every image a pack needs painted before its stages are captured.
export function packImageSources(cards: DemoCard[]): string[] {
  const out = new Set<string>();
  for (const c of cards) {
    for (const l of [...c.project.layers, ...c.overlay, ...(c.mainMask ? [c.mainMask] : [])]) {
      if (l.type === "image" && l.src) out.add(l.src);
    }
  }
  return [...out];
}
