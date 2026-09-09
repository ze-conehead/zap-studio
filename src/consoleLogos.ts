// "Find logos" from the global template: one logo per console, dropped into
// that console's template as an image layer. The per-card logo sweep is
// gone — a logo belongs to the console, not the individual game.

import { getCatalog } from "./data/catalog";
import {
  fitImageToSlot,
  makeImageLayer,
  newConsoleTemplate,
  templateId,
} from "./factory";
import { t } from "./i18n";
import { urlToLayerSource } from "./image";
import { loadProject, saveProject } from "./persist";
import { loadLogoSlot } from "./templates";

export interface ConsoleRow {
  consoleId: string;
  consoleName: string;
}

const hasLogo = (layers: { type: string; logo?: boolean }[]) =>
  layers.some((l) => l.type === "image" && l.logo);

/** Consoles whose template has no logo image yet, in catalogue order. */
export async function consolesWithoutLogo(): Promise<ConsoleRow[]> {
  const rows: ConsoleRow[] = [];
  for (const c of getCatalog()) {
    const tpl = await loadProject(templateId(c.id));
    if (!tpl || !hasLogo(tpl.layers)) {
      rows.push({ consoleId: c.id, consoleName: c.name });
    }
  }
  return rows;
}

/** Embeds `url` and adds it as a logo image layer on the console's template. */
export async function insertConsoleLogo(
  row: ConsoleRow,
  url: string,
): Promise<void> {
  const img = await urlToLayerSource(url);
  const layer = fitImageToSlot(
    { ...makeImageLayer({ ...img, name: t("Logo") }), logo: true },
    await loadLogoSlot(),
  );
  const existing = await loadProject(templateId(row.consoleId));
  const base = existing ?? newConsoleTemplate(row.consoleId, row.consoleName);
  await saveProject({
    ...base,
    consoleName: row.consoleName,
    layers: [...base.layers, layer],
    updatedAt: Date.now(),
  });
}
