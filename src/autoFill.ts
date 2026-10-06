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
import { saveSnapshot } from "./snapshots";
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
  // A console logo only draws inside the global template's logo slot — with
  // no slot there is nowhere for one to go, so no logos are planned.
  logoSlot: boolean;
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

// One picture the run put in, with what else the source offered — the
// review grid steps through `candidates` from there.
export interface FilledFrame {
  kind: "logo" | "cover" | "screenshot";
  key: string; // gameKey, or the consoleId for a logo
  consoleName: string;
  title: string; // game title, or the console name for a logo
  mask?: Layer; // the frame it fills (logos sit in the logo slot instead)
  layerId: string;
  candidates: string[];
  index: number; // which candidate is in now
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
  filled: FilledFrame[];
}

/**
 * What an auto-fill would do right now: consoles without a logo, and the
 * cards whose cover / screenshot frames are still empty. `consoleId` scopes
 * it to one console.
 */
export async function planAutoFill(consoleId?: string): Promise<AutoFillPlan> {
  const globalP = await loadProject(GLOBAL_TEMPLATE_ID);
  const logoSlot = !!globalP?.layers.some((l) => l.logoSlot);
  const logos = logoSlot
    ? (await consolesWithoutLogo()).filter((r) => !consoleId || r.consoleId === consoleId)
    : [];
  const globalMasks = alphaMasksOf(globalP);
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
  return { logoSlot, logos, covers, screenshots };
}

/** Runs the chosen phases of `plan` in order: logos, covers, screenshots. */
export async function runAutoFill(
  plan: AutoFillPlan,
  opts: AutoFillOptions,
  onProgress: (p: AutoFillProgress) => void,
  signal: AbortSignal,
): Promise<AutoFillReport> {
  const report: AutoFillReport = {
    logos: 0,
    covers: 0,
    screenshots: 0,
    missing: 0,
    failed: 0,
    filled: [],
  };
  const fail = (e: unknown) => {
    report.failed++;
    report.firstError ??= (e as Error).message;
  };
  // Every design / template this run is about to change gets an automatic
  // snapshot first (once), so the whole run can be rolled back per card.
  const snapped = new Set<string>();
  const snapshotFirst = async (projectId: string | undefined) => {
    if (!projectId || snapped.has(projectId)) return;
    snapped.add(projectId);
    const p = await loadProject(projectId);
    if (p) await saveSnapshot(p, t("Before auto-fill"), { auto: true });
  };

  if (opts.logos) {
    for (const [i, row] of plan.logos.entries()) {
      if (signal.aborted) return report;
      onProgress({ phase: "logos", done: i, total: plan.logos.length, label: row.consoleName });
      try {
        const candidates = (await searchLogos(row.consoleName)).map((c) => c.url);
        const url = candidates[0];
        if (!url) report.missing++;
        else {
          await snapshotFirst(templateId(row.consoleId));
          const layerId = await insertConsoleLogo(row, url);
          report.logos++;
          report.filled.push({
            kind: "logo",
            key: row.consoleId,
            consoleName: row.consoleName,
            title: row.consoleName,
            layerId,
            candidates,
            index: 0,
          });
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
        const urls = (await search(row.consoleName, row.gameTitle)).map((c) => c.url);
        if (!urls.length) {
          report.missing++;
          continue;
        }
        await snapshotFirst(getGameProject(row.gameKey));
        // Distinct pictures: each frame takes the next candidate; one that
        // can't be fetched is skipped for the one after it.
        let next = 0;
        let short = false;
        for (const mask of task.masks) {
          let done = false;
          while (!done && next < urls.length && !signal.aborted) {
            const index = next++;
            const [hit] = await insertMaskImages(row, [
              { url: urls[index], mask, name: phase === "covers" ? t("Main image") : mask.name },
            ]);
            if (hit) {
              done = true;
              report[phase]++;
              report.filled.push({
                kind: phase === "covers" ? "cover" : "screenshot",
                key: row.gameKey,
                consoleName: row.consoleName,
                title: row.gameTitle,
                mask,
                layerId: hit.layerId,
                candidates: urls,
                index,
              });
            }
          }
          if (!done) short = true;
        }
        if (short) report.missing++;
      } catch (e) {
        fail(e);
      }
    }
  };

  if (opts.covers) await frames("covers", plan.covers, searchCovers);
  if (opts.screenshots) await frames("screenshots", plan.screenshots, searchScreenshots);
  return report;
}
