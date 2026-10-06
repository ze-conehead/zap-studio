// Template packs: the global template and console templates of a project,
// with the custom fonts they use, as one file — to reuse a layout in another
// project or hand it to someone else. Cards are not included. Pictures are
// already embedded in the layers as data URLs.

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";
import { listCustomFonts, ensureCustomFontsLoaded, importCustomFont, type CustomFont } from "./customFonts";
import { addConsole, getCatalog } from "./data/catalog";
import { GLOBAL_TEMPLATE_ID, migrateProject, templateId } from "./factory";
import { getFormatId, type FormatId } from "./formats";
import { t } from "./i18n";
import { loadProject, saveProject } from "./persist";
import { saveSnapshot } from "./snapshots";
import type { Project } from "./types";

const KIND = "zap-studio-template-pack";

export interface PackTemplate {
  consoleId?: string; // absent = the global template
  consoleName?: string;
  project: Project;
}

export interface TemplatePack {
  kind: typeof KIND;
  version: 1;
  format: FormatId;
  exportedAt: number;
  templates: PackTemplate[];
  fonts: CustomFont[];
}

/** Every template this project has, global first. */
export async function listTemplates(): Promise<PackTemplate[]> {
  const out: PackTemplate[] = [];
  const g = await loadProject(GLOBAL_TEMPLATE_ID);
  if (g) out.push({ project: g });
  for (const c of getCatalog()) {
    const p = await loadProject(templateId(c.id));
    if (p) out.push({ consoleId: c.id, consoleName: c.name, project: p });
  }
  return out;
}

export async function buildPack(templates: PackTemplate[]): Promise<Blob> {
  await ensureCustomFontsLoaded();
  const json = JSON.stringify(templates);
  // Only the fonts some layer actually names.
  const fonts = listCustomFonts().filter((f) => json.includes(f.family));
  const pack: TemplatePack = {
    kind: KIND,
    version: 1,
    format: getFormatId(),
    exportedAt: Date.now(),
    templates,
    fonts,
  };
  const zipped = zipSync({ "pack.json": strToU8(JSON.stringify(pack)) }, { level: 6 });
  return new Blob([zipped], { type: "application/zip" });
}

export async function readPack(file: File): Promise<TemplatePack> {
  let pack: TemplatePack | undefined;
  try {
    const entries = unzipSync(new Uint8Array(await file.arrayBuffer()));
    if (entries["pack.json"]) pack = JSON.parse(strFromU8(entries["pack.json"])) as TemplatePack;
  } catch {
    /* not a zip */
  }
  if (!pack || pack.kind !== KIND || !Array.isArray(pack.templates)) {
    throw new Error(t("That file is not a Zap-Studio template pack."));
  }
  return pack;
}

/** Where a pack's console template lands here: same id, else same name, else a new console. */
function targetConsole(t: PackTemplate): { id: string; name: string; isNew: boolean } {
  const cat = getCatalog();
  const byId = cat.find((c) => c.id === t.consoleId);
  if (byId) return { id: byId.id, name: byId.name, isNew: false };
  const name = (t.consoleName ?? t.consoleId ?? "").trim();
  const byName = cat.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (byName) return { id: byName.id, name: byName.name, isNew: false };
  return { id: "", name, isNew: true };
}

/** For the import list: does this template replace one here, or add a console? */
export async function describeImport(
  p: PackTemplate,
): Promise<{ replaces: boolean; newConsole: boolean; name: string }> {
  if (!p.consoleId) {
    return { replaces: !!(await loadProject(GLOBAL_TEMPLATE_ID)), newConsole: false, name: "" };
  }
  const target = targetConsole(p);
  return {
    replaces: !target.isNew && !!(await loadProject(templateId(target.id))),
    newConsole: target.isNew,
    name: target.name,
  };
}

/**
 * Brings `chosen` templates in — each existing one is snapshotted first
 * ("Before template import"), consoles that don't exist yet are added, and
 * the fonts they use are installed. Returns how many templates were written.
 */
export async function importPack(pack: TemplatePack, chosen: PackTemplate[]): Promise<number> {
  for (const f of pack.fonts ?? []) {
    if (f.id && f.family && f.dataUrl) await importCustomFont(f);
  }
  let n = 0;
  for (const tpl of chosen) {
    let id = GLOBAL_TEMPLATE_ID;
    let consoleId: string | undefined;
    let consoleName: string | undefined;
    if (tpl.consoleId) {
      const target = targetConsole(tpl);
      const c = target.isNew ? addConsole(target.name) : undefined;
      consoleId = target.isNew ? c?.id : target.id;
      consoleName = target.isNew ? c?.name : target.name;
      if (!consoleId) continue;
      id = templateId(consoleId);
    }
    const existing = await loadProject(id);
    if (existing) await saveSnapshot(existing, t("Before template import"), { auto: true });
    const now = Date.now();
    await saveProject(
      migrateProject({
        ...tpl.project,
        id,
        format: getFormatId(),
        isTemplate: true,
        isGlobalTemplate: !tpl.consoleId || undefined,
        consoleId,
        consoleName,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }),
    );
    n++;
  }
  return n;
}
