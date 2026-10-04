// "Auto-fill": the fully automatic counterpart of Find logos / Find cover.
// No search dialog, no picking — for every console without a logo it takes
// the first logo found, then for every card it fills the empty screenshot
// frames (and, if asked, the cover frame) with the first few distinct
// pictures the configured source returns. Works on what's on disk, one step
// at a time, so cancelling keeps everything done so far.

import { getCatalog, gameKeyOf } from "./data/catalog";
import { GLOBAL_TEMPLATE_ID, templateId } from "./factory";
import { searchCovers, searchLogos, searchScreenshots, type CoverCandidate } from "./covers";
import { consolesWithoutLogo, insertConsoleLogo, type ConsoleRow } from "./consoleLogos";
import { getGameProject } from "./gameIndex";
import { t } from "./i18n";
import { loadProject } from "./persist";
import { insertMaskImages, type QuickImportRow } from "./quickImport";
import { alphaMasksOf, mainMaskOf, resolveMask, screenshotMasksOf } from "./templates";
import type { Layer } from "./types";

export interface AutoFillOptions {
  logos: boolean;
  covers: boolean;
  screenshots: boolean;
}

// A card and the empty frames of it that a phase will fill.
export interface FillTask {
  row: QuickImportRow;
  masks: Layer[];
}

export interface AutoFillPlan {
  logos: ConsoleRow[];
  covers: FillTask[];
  screenshots: FillTask[];
}

export interface AutoFillProgress {
  phase: keyof AutoFillOptions;
  done: number;
  total: number;
  label: string;
}

export interface AutoFillReport {
  logos: number;
  covers: number;
  screenshots: number;
  // Steps where the source had nothing (or only unusable pictures).
  missing: number;
  // Steps that errored — the first message, to point at a missing API key etc.
  failed: number;
  firstError?: string;
}

/**
 * What an auto-fill would do right now: consoles without a logo, and the
 * cards whose cover / screenshot frames are still empty. `consoleId` scopes
 * it to one console.
 */
export async function planAutoFill(consoleId?: string): Promise<AutoFillPlan> {
  const logos = (await consolesWithoutLogo()).filter((r) => !consoleId || r.consoleId === consoleId);
  const globalMasks = alphaMasksOf(await loadProject(GLOBAL_TEMPLATE_ID));
  const covers: FillTask[] = [];
  const screenshots: FillTask[] = [];

  for (const c of getCatalog()) {
    if (consoleId && c.id !== consoleId) continue;
    const masks = [...globalMasks, ...alphaMasksOf(await loadProject(templateId(c.id)))];
    const cover = mainMaskOf(masks);
    const shots = screenshotMasksOf(masks);
    if (!cover && !shots.length) continue;

    for (const g of c.games) {
      const gameKey = gameKeyOf(c, g);
      const pid = getGameProject(gameKey);
      const project = pid ? await loadProject(pid) : undefined;
      const filled = new Set(
        (project?.layers ?? [])
          .filter((l) => l.type === "image")
          .map((l) => resolveMask(l, masks)?.id),
      );
      const row = { gameKey, consoleName: c.name, gameTitle: g.title };
      if (cover && !filled.has(cover.id)) covers.push({ row, masks: [cover] });
      const empty = shots.filter((m) => !filled.has(m.id));
      if (empty.length) screenshots.push({ row, masks: empty });
    }
  }
  return { logos, covers, screenshots };
}

const first = (c: CoverCandidate[]) => c[0]?.url;

/** Runs the chosen phases of `plan` in order: logos, covers, screenshots. */
export async function runAutoFill(
  plan: AutoFillPlan,
  opts: AutoFillOptions,
  onProgress: (p: AutoFillProgress) => void,
  signal: AbortSignal,
): Promise<AutoFillReport> {
  const report: AutoFillReport = { logos: 0, covers: 0, screenshots: 0, missing: 0, failed: 0 };
  const fail = (e: unknown) => {
    report.failed++;
    report.firstError ??= (e as Error).message;
  };

  if (opts.logos) {
    for (const [i, row] of plan.logos.entries()) {
      if (signal.aborted) return report;
      onProgress({ phase: "logos", done: i, total: plan.logos.length, label: row.consoleName });
      try {
        const url = first(await searchLogos(row.consoleName));
        if (!url) report.missing++;
        else {
          await insertConsoleLogo(row, url);
          report.logos++;
        }
      } catch (e) {
        fail(e);
      }
    }
  }

  const frames = async (
    phase: "covers" | "screenshots",
    tasks: FillTask[],
    search: (consoleName: string, title: string) => Promise<CoverCandidate[]>,
  ) => {
    for (const [i, task] of tasks.entries()) {
      if (signal.aborted) return;
      const { row } = task;
      onProgress({ phase, done: i, total: tasks.length, label: `${row.consoleName} – ${row.gameTitle}` });
      try {
        const cands = await search(row.consoleName, row.gameTitle);
        // Distinct pictures: each frame takes the next candidate. Hand out
        // one per frame; a candidate that turns out unusable is replaced by
        // a spare from the list.
        const urls = cands.map((c) => c.url);
        const items = task.masks.slice(0, urls.length).map((mask, k) => ({
          url: urls[k],
          mask,
          name: phase === "covers" ? t("Main image") : mask.name,
        }));
        if (!items.length) {
          report.missing++;
          continue;
        }
        let filled = await insertMaskImages(row, items);
        const spare = urls.slice(items.length);
        // Retry the frames that failed with the spare candidates.
        let left = task.masks.filter((m) => !filled.some((f) => f.id === m.id));
        while (left.length && spare.length && !signal.aborted) {
          const retry = left.slice(0, spare.length).map((mask) => ({
            url: spare.shift() as string,
            mask,
            name: phase === "covers" ? t("Main image") : mask.name,
          }));
          filled = [...filled, ...(await insertMaskImages(row, retry))];
          left = task.masks.filter((m) => !filled.some((f) => f.id === m.id));
        }
        report[phase] += filled.length;
        if (left.length) report.missing++;
      } catch (e) {
        fail(e);
      }
    }
  };

  if (opts.covers) await frames("covers", plan.covers, searchCovers);
  if (opts.screenshots) await frames("screenshots", plan.screenshots, searchScreenshots);
  return report;
}
