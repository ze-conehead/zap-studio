// Template bundles: the whole look of a card set — the "All consoles"
// template plus every console template — as one portable JSON file, with a
// preview image so a viewer can show what it looks like before you apply it.
//
// Saved bundles live in IndexedDB beside the projects (workspace-namespaced,
// like everything else), so the viewer can list them without a file picker.

import { get, set, del, keys } from "idb-keyval";
import { GLOBAL_TEMPLATE_ID, templateId } from "./factory";
import { getFormatId, type FormatId } from "./formats";
import { t } from "./i18n";
import { loadAllProjects, loadProject, saveProject } from "./persist";
import { wsIdbPrefix } from "./workspace";
import type { Project } from "./types";

export const BUNDLE_FORMAT = "credit-card-sticker-studio-template";

export interface BundleConsole {
  consoleId: string;
  consoleName: string;
  project: Project;
}

export interface TemplateBundle {
  format: typeof BUNDLE_FORMAT;
  version: 1;
  id: string;
  name: string;
  description?: string;
  /** Which card format the template was built for. */
  cardFormat: FormatId;
  createdAt: number;
  /** PNG data URL of a sample card, for the viewer. */
  preview?: string;
  global?: Project;
  consoles: BundleConsole[];
}

const KEY = (id: string) => `${wsIdbPrefix()}template:${id}`;
const PREFIX = `${wsIdbPrefix()}template:`;

const uid = () =>
  crypto.randomUUID?.() ?? `tpl-${Date.now()}-${Math.random().toString(16).slice(2)}`;

// ── building one from the workspace ────────────────────────────────────────

/** Collects the current global + console templates into a bundle. */
export async function buildBundle(opts: {
  name: string;
  description?: string;
  preview?: string;
}): Promise<TemplateBundle> {
  const all = await loadAllProjects();
  const consoles: BundleConsole[] = [];
  for (const p of all) {
    if (!p.isTemplate || p.isGlobalTemplate || !p.consoleId) continue;
    consoles.push({
      consoleId: p.consoleId,
      consoleName: p.consoleName ?? p.consoleId,
      project: p,
    });
  }
  consoles.sort((a, b) => a.consoleName.localeCompare(b.consoleName));

  return {
    format: BUNDLE_FORMAT,
    version: 1,
    id: uid(),
    name: opts.name.trim() || t("Template"),
    description: opts.description?.trim() || undefined,
    cardFormat: getFormatId(),
    createdAt: Date.now(),
    preview: opts.preview,
    global: await loadProject(GLOBAL_TEMPLATE_ID),
    consoles,
  };
}

// ── file in / out ──────────────────────────────────────────────────────────

export const serializeBundle = (b: TemplateBundle) => JSON.stringify(b, null, 2);

export function parseBundle(json: string): TemplateBundle {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error(t("That file isn't valid JSON."));
  }
  const b = raw as Partial<TemplateBundle>;
  if (b.format !== BUNDLE_FORMAT) {
    throw new Error(t("Not a template file."));
  }
  if (!b.global && !(b.consoles ?? []).length) {
    throw new Error(t("The template is empty."));
  }
  return {
    format: BUNDLE_FORMAT,
    version: 1,
    id: b.id || uid(),
    name: b.name || t("Template"),
    description: b.description,
    cardFormat: (b.cardFormat as FormatId) ?? "card",
    createdAt: b.createdAt ?? Date.now(),
    preview: b.preview,
    global: b.global,
    consoles: (b.consoles ?? []).filter((c) => c && c.consoleId && c.project),
  };
}

// ── applying ───────────────────────────────────────────────────────────────

/**
 * Writes the bundle's templates over the workspace's own. Game cards are
 * untouched — only the shared layers change. Returns what it replaced.
 */
export async function applyBundle(
  b: TemplateBundle,
): Promise<{ global: boolean; consoles: number }> {
  let globalDone = false;
  if (b.global) {
    await saveProject({
      ...b.global,
      id: GLOBAL_TEMPLATE_ID,
      format: getFormatId(),
      isTemplate: true,
      isGlobalTemplate: true,
      updatedAt: Date.now(),
    });
    globalDone = true;
  }
  let n = 0;
  for (const c of b.consoles) {
    await saveProject({
      ...c.project,
      id: templateId(c.consoleId),
      format: getFormatId(),
      isTemplate: true,
      isGlobalTemplate: false,
      consoleId: c.consoleId,
      consoleName: c.consoleName,
      updatedAt: Date.now(),
    });
    n++;
  }
  return { global: globalDone, consoles: n };
}

// ── the shelf of saved bundles ─────────────────────────────────────────────

export async function saveBundle(b: TemplateBundle): Promise<void> {
  await set(KEY(b.id), b);
}

export async function listBundles(): Promise<TemplateBundle[]> {
  const out: TemplateBundle[] = [];
  for (const k of (await keys()) as string[]) {
    if (typeof k !== "string" || !k.startsWith(PREFIX)) continue;
    const b = (await get(k)) as TemplateBundle | undefined;
    if (b?.format === BUNDLE_FORMAT) out.push(b);
  }
  return out.sort((a, b) => b.createdAt - a.createdAt);
}

export const deleteBundle = (id: string) => del(KEY(id));

/** A filename that survives a round trip through a file manager. */
export const bundleFileName = (b: TemplateBundle) =>
  `${(b.name.replace(/[^\w-]+/g, "_").slice(0, 40) || "template")}.template.json`;
