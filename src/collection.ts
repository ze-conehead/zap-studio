// "Collection status": per console, what every card is still missing — a
// design at all, pictures in the template's frames, metadata — plus what the
// preflight finds and pictures shared with another card. One read over
// storage; the dialog (CollectionStatusDialog) turns it into a to-do list.

import { consolesWithoutLogo } from "./consoleLogos";
import { getCatalog } from "./data/catalog";
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
