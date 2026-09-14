// When an alpha mask (in the global or a console template) is moved,
// resized or rotated, every image layer that points at it — across every
// stored project, not just the one open in the editor — needs to be
// re-fitted so it stays aligned with the mask's new box. A card's own image
// bakes its fit (x/y/rotation/width/height) at insertion time (see
// fitImageToMask in factory.ts); nothing keeps it in sync afterwards on its
// own.
//
// An image can point at a mask three ways — resolveMask() in templates.ts
// is the one place that already knows all of them: an explicit `maskId`
// (what "Find cover" on the open card writes), or the legacy `main`/`shot`
// index-into-the-mask-list flags (what the bulk "Quick Import" / cover-sweep
// insert path still writes). Resolving `main`/`shot` needs the same ordered
// [global masks…, console masks…] list the live editor builds per card (see
// App.tsx) — so this rebuilds that list per project instead of only
// matching on `maskId`, or every image inserted via a sweep would be missed.

import { fitImageToMask, GLOBAL_TEMPLATE_ID } from "./factory";
import { loadAllProjects, saveProject } from "./persist";
import { alphaMasksOf, resolveMask } from "./templates";
import type { ImageLayer, Layer, Project } from "./types";

/**
 * Re-fits every image layer that resolves to `mask` (by `maskId`, or the
 * legacy `main`/`shot` position), in every stored project, to `mask`'s
 * current geometry — and persists the ones that changed. Refits from each
 * image's natural size (not its previously-fitted width/height), so
 * repeated mask edits stay stable instead of compounding. `excludeProjectId`
 * skips the mask's own (currently open) project — that one is already being
 * saved by the live editor, and re-saving it here too could race with it.
 * Returns how many images were updated.
 */
export async function sweepMaskMove(
  mask: Layer,
  excludeProjectId?: string,
): Promise<number> {
  const projects = await loadAllProjects();
  const global = projects.find((p) => p.id === GLOBAL_TEMPLATE_ID);
  const globalMasks = alphaMasksOf(global);
  const consoleTemplates = new Map<string, Project>(
    projects
      .filter((p): p is Project & { consoleId: string } => !!(p.isTemplate && p.consoleId))
      .map((p) => [p.consoleId, p]),
  );

  let touched = 0;
  for (const p of projects) {
    if (p.id === excludeProjectId) continue;
    const consoleId = p.gameKey?.split("/")[0] ?? (p.isTemplate ? p.consoleId : undefined);
    const consoleMasks = consoleId ? alphaMasksOf(consoleTemplates.get(consoleId)) : [];
    // The moved mask's geometry may not have reached storage yet (or this
    // *is* its own project, already excluded) — use the live copy so the
    // fit is computed from where it actually is right now.
    const masks = [...globalMasks, ...consoleMasks].map((m) =>
      m.id === mask.id ? mask : m,
    );
    if (!masks.some((m) => m.id === mask.id)) continue; // out of this project's reach

    let changed = false;
    const layers = p.layers.map((l) => {
      if (l.type !== "image") return l;
      const resolved = resolveMask(l, masks);
      if (!resolved || resolved.id !== mask.id) return l;
      const natural: ImageLayer = { ...l, width: l.naturalWidth, height: l.naturalHeight };
      const refit = fitImageToMask(natural, mask);
      if (
        refit.x === l.x &&
        refit.y === l.y &&
        refit.width === l.width &&
        refit.height === l.height
      ) {
        return l;
      }
      changed = true;
      touched++;
      return refit;
    });
    if (changed) await saveProject({ ...p, layers, updatedAt: Date.now() });
  }
  return touched;
}
