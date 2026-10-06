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
import type { ImageLayer, Layer } from "./types";

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

/** Embeds `url` as a logo image layer, fitted into the "All consoles" slot. */
export async function makeConsoleLogoLayer(
  url: string,
  slot: Layer | undefined,
): Promise<ImageLayer> {
  const img = await urlToLayerSource(url);
  return fitImageToSlot(
    { ...makeImageLayer({ ...img, name: t("Logo") }), logo: true },
    slot,
  );
}

/** Embeds `url` and adds it as a logo image layer on the console's template. Returns the new layer's id. */
export async function insertConsoleLogo(
  row: ConsoleRow,
  url: string,
): Promise<string> {
  const layer = await makeConsoleLogoLayer(url, await loadLogoSlot());
  const existing = await loadProject(templateId(row.consoleId));
  const base = existing ?? newConsoleTemplate(row.consoleId, row.consoleName);
  await saveProject({
    ...base,
    consoleName: row.consoleName,
    layers: [...base.layers, layer],
    updatedAt: Date.now(),
  });
  return layer.id;
}

/** Swaps the picture of a console's logo layer for `url`, fitted into the logo slot again. */
export async function replaceConsoleLogo(consoleId: string, layerId: string, url: string): Promise<void> {
  const p = await loadProject(templateId(consoleId));
  const old = p?.layers.find((l) => l.id === layerId);
  if (!p || !old) throw new Error(t("That image is no longer there."));
  const fresh = await makeConsoleLogoLayer(url, await loadLogoSlot());
  await saveProject({
    ...p,
    layers: p.layers.map((l) => (l.id === layerId ? { ...fresh, id: layerId } : l)),
    updatedAt: Date.now(),
  });
}

/** Drops one layer from a console's template on disk. */
export async function removeConsoleLayer(consoleId: string, layerId: string): Promise<void> {
  const p = await loadProject(templateId(consoleId));
  if (!p) return;
  await saveProject({ ...p, layers: p.layers.filter((l) => l.id !== layerId), updatedAt: Date.now() });
}
