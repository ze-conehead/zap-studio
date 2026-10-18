// "Collection status": per console, what every card is still missing — a
// design at all, pictures in the template's frames, metadata — plus what the
// preflight finds and pictures shared with another card. One read over
// storage; the dialog (CollectionStatusDialog) turns it into a to-do list.

import { consolesWithoutLogo } from "./consoleLogos";
import { planAutoFill } from "./autoFill";
import { gameKeyOf, getCatalog } from "./data/catalog";
import { GLOBAL_TEMPLATE_ID } from "./factory";
import { loadProject } from "./persist";
import { findDuplicates } from "./duplicates";
import { findMeta, loadGamelist } from "./gamelist";
import { loadOverviewCards } from "./overview";
import { checkCards } from "./preflight";
import { resolveMask } from "./templates";

export interface GameStatus {
  gameKey: string;
  title: string;
  hasDesign: boolean;
  framesFilled: number;
  framesTotal: number;
  hasMeta: boolean;
  errors: number;
  warnings: number;
  sharesPictureWith: string[]; // titles of the other cards with the same picture
}

export interface ConsoleStatus {
  consoleId: string;
  consoleName: string;
  // Only meaningful when the global template has a logo slot to show it in.
  hasLogo: boolean;
  logoSlot: boolean;
  games: GameStatus[];
}

/** True when a card still has something to do. */
export const hasGaps = (g: GameStatus) =>
  !g.hasDesign ||
  g.framesFilled < g.framesTotal ||
  !g.hasMeta ||
  g.errors > 0 ||
  g.sharesPictureWith.length > 0;

/**
 * The cards with a gap a picture would fill: an empty cover or screenshot
 * container, or — when "All consoles" has a logo slot — a console without a
 * logo (which leaves all of its cards without one). The card list's
 * "with gaps" filter. A light read: no preflight, no duplicate search.
 */
export async function loadGapKeys(): Promise<Set<string>> {
  const plan = await planAutoFill();
  const keys = new Set<string>();
  for (const task of [...plan.covers, ...plan.screenshots]) keys.add(task.row.gameKey);
  if (plan.logoSlot) {
    const noLogo = new Set(plan.logos.map((r) => r.consoleId));
    for (const c of getCatalog()) {
      if (noLogo.has(c.id)) for (const g of c.games) keys.add(gameKeyOf(c, g));
    }
  }
  return keys;
}

/** What one card's picture frames still lack. */
export interface PictureGap {
  cover: boolean; // an empty cover container
  shotsMissing: number; // empty screenshot containers …
  shotsTotal: number; // … of this many
}

/**
 * Per card (by game key): the cover and screenshot frames still empty.
 * Cards with every frame filled — and cards of a template without such
 * frames — are left out. The export dialogs flag these.
 */
export async function loadPictureGaps(): Promise<Map<string, PictureGap>> {
  const plan = await planAutoFill();
  const out = new Map<string, PictureGap>();
  const gap = (key: string) => {
    let g = out.get(key);
    if (!g) out.set(key, (g = { cover: false, shotsMissing: 0, shotsTotal: 0 }));
    return g;
  };
  for (const task of plan.covers) gap(task.row.gameKey).cover = true;
  for (const task of plan.screenshots) {
    const g = gap(task.row.gameKey);
    g.shotsMissing = task.masks.length;
    g.shotsTotal = task.of;
  }
  return out;
}

export async function loadCollectionStatus(): Promise<ConsoleStatus[]> {
  const cards = await loadOverviewCards();
  const noLogo = new Set((await consolesWithoutLogo()).map((r) => r.consoleId));
  const logoSlot = !!(await loadProject(GLOBAL_TEMPLATE_ID))?.layers.some((l) => l.logoSlot);

  // Preflight findings per card ("empty" is the same thing as "no design").
  const findings = checkCards(
    cards.map((c) => ({
      name: c.gameTitle,
      gameKey: c.key,
      consoleName: c.consoleName,
      project: c.card.project,
      overlay: c.card.overlay,
    })),
  );
  const issues = new Map<string, { errors: number; warnings: number }>();
  for (const f of findings) {
    if (f.code === "empty") continue;
    for (const where of f.cards) {
      if (!where.gameKey) continue;
      const e = issues.get(where.gameKey) ?? { errors: 0, warnings: 0 };
      if (f.severity === "error") e.errors++;
      else e.warnings++;
      issues.set(where.gameKey, e);
    }
  }

  const shared = new Map<string, Set<string>>();
  for (const group of findDuplicates(
    cards.filter((c) => c.hasDesign).map((c) => ({ key: c.key, title: c.gameTitle, layers: c.card.project.layers })),
  )) {
    for (const use of group) {
      const set = shared.get(use.key) ?? new Set<string>();
      for (const other of group) if (other.key !== use.key) set.add(other.title);
      shared.set(use.key, set);
    }
  }

  const out: ConsoleStatus[] = [];
  for (const c of getCatalog()) {
    const metas = loadGamelist(c.id);
    const games = cards
      .filter((x) => x.consoleId === c.id)
      .map((x): GameStatus => {
        const masks = x.card.masks ?? [];
        const filled = new Set(
          x.card.project.layers
            .filter((l) => l.type === "image")
            .map((l) => resolveMask(l, masks)?.id)
            .filter(Boolean),
        );
        return {
          gameKey: x.key,
          title: x.gameTitle,
          hasDesign: x.hasDesign,
          framesFilled: masks.filter((m) => filled.has(m.id)).length,
          framesTotal: masks.length,
          hasMeta: !!findMeta(metas, x.gameTitle),
          errors: issues.get(x.key)?.errors ?? 0,
          warnings: issues.get(x.key)?.warnings ?? 0,
          sharesPictureWith: [...(shared.get(x.key) ?? [])],
        };
      });
    out.push({ consoleId: c.id, consoleName: c.name, hasLogo: !noLogo.has(c.id), logoSlot, games });
  }
  return out;
}
