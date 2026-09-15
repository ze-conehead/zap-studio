// "All cards": every game in the catalogue as a finished card, whether or not
// it has a saved design yet. Same template assembly the demo packs and the
// print sheets use, so what the overview shows is what the editor draws.

import { gameKeyOf, getCatalog } from "./data/catalog";
import { GLOBAL_TEMPLATE_ID, isBackground, newProject, templateId } from "./factory";
import { getGameProject } from "./gameIndex";
import { loadProject } from "./persist";
import { alphaMasksOf } from "./templates";
import type { DemoCard } from "./demo";
import type { Project } from "./types";

export interface OverviewCard {
  key: string; // catalogue gameKey — also the React key
  consoleId: string;
  consoleName: string;
  gameTitle: string;
  hasDesign: boolean; // false => the card is only its templates
  card: DemoCard; // ready to hand to <CardStage>
}

export async function loadOverviewCards(): Promise<OverviewCard[]> {
  const bgFill = (p?: Project) => {
    const bg = p?.layers.find(isBackground);
    return bg?.visible ? bg.fill : undefined;
  };
  const overlayable = (p?: Project) =>
    (p?.layers ?? []).filter(
      (l) => !l.logoSlot && !isBackground(l), // alpha masks stay: they mark where a card's image slots in
    );

  const globalP = await loadProject(GLOBAL_TEMPLATE_ID);
  const globalBg = bgFill(globalP);
  const globalMasks = alphaMasksOf(globalP);
  const globalLayers = overlayable(globalP);
  const globalBack = globalP?.back;

  const tplCache = new Map<string, Project | undefined>();
  const out: OverviewCard[] = [];

  for (const c of getCatalog()) {
    if (!tplCache.has(c.id)) {
      tplCache.set(c.id, await loadProject(templateId(c.id)));
    }
    const consoleP = tplCache.get(c.id);
    const overlay = [...overlayable(consoleP), ...globalLayers];
    const consoleBg = bgFill(consoleP);
    // A game with no back of its own borrows the console template's, then
    // the global one's.
    const inheritedBack = consoleP?.back ?? globalBack;

    for (const g of c.games) {
      const key = gameKeyOf(c, g);
      const pid = getGameProject(key);
      const saved = pid ? await loadProject(pid) : undefined;

      out.push({
        key,
        consoleId: c.id,
        consoleName: c.name,
        gameTitle: g.title,
        hasDesign: !!saved,
        card: {
          key,
          consoleName: c.name,
          gameTitle: g.title,
          // No design yet: an empty project still renders the console and
          // global templates, which is exactly what that card looks like.
          project: saved ?? newProject(g.title),
          overlay,
          consoleBg,
          globalBg,
          masks: [...globalMasks, ...alphaMasksOf(consoleP)],
          back: saved?.back ?? inheritedBack,
          holo: false,
        },
      });
    }
  }
  return out;
}
