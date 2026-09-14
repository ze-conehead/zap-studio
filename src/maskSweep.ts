// When an alpha mask (in the global or a console template) is moved,
// resized or rotated, every image layer that points at it — across every
// stored project, not just the one open in the editor — needs to be
// re-fitted so it stays aligned with the mask's new box. A card's own image
// bakes its fit (x/y/rotation/width/height) at insertion time (see
// fitImageToMask in factory.ts); nothing keeps it in sync afterwards on its
// own.

import { fitImageToMask } from "./factory";
import { loadAllProjects, saveProject } from "./persist";
import type { ImageLayer, Layer } from "./types";

/**
 * Re-fits every image layer whose `maskId` points at `mask.id`, in every
 * stored project, to `mask`'s current geometry — and persists the ones that
 * changed. Refits from each image's natural size (not its previously-fitted
 * width/height), so repeated mask edits stay stable instead of compounding.
 * `excludeProjectId` skips the mask's own (currently open) project — that
 * one is already being saved by the live editor, and re-saving it here too
 * could race with it. Returns how many images were updated.
 */
export async function sweepMaskMove(
  mask: Layer,
  excludeProjectId?: string,
): Promise<number> {
  const projects = await loadAllProjects();
  let touched = 0;
  for (const p of projects) {
    if (p.id === excludeProjectId) continue;
    let changed = false;
    const layers = p.layers.map((l) => {
      if (l.type !== "image" || l.maskId !== mask.id) return l;
      const natural: ImageLayer = { ...l, width: l.naturalWidth, height: l.naturalHeight };
      const refit = fitImageToMask(natural, mask);
      if (refit.x === l.x && refit.y === l.y && refit.width === l.width && refit.height === l.height) {
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
