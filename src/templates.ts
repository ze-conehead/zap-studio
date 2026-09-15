import { GLOBAL_TEMPLATE_ID } from "./factory";
import { loadProject } from "./persist";
import type { Layer, Project, ShapeLayer } from "./types";

/** An alpha mask plus where it came from, for the card's mask picker. */
export interface MaskOption {
  layer: Layer;
  source: "global" | "console";
}

// Only a shape can be an alpha frame — its box is the frame. Migration
// strips the flag off anything else, this is the backstop.
export const isAlphaMask = (l: Layer): l is ShapeLayer =>
  l.type === "shape" && !!(l.alphaMask || l.mainMask || l.shotMask);

/** The alpha masks of one project, in layer order. */
export function alphaMasksOf(p: Project | undefined): Layer[] {
  return (p?.layers ?? []).filter((l) => isAlphaMask(l) && l.visible);
}

/**
 * Every frame a card can point at: the global template's first — so the
 * historical "the global mask clips the cover" stays true — then the
 * console's own.
 */
export function maskOptions(
  globalP: Project | undefined,
  consoleP: Project | undefined,
): MaskOption[] {
  return [
    ...alphaMasksOf(globalP).map((layer) => ({ layer, source: "global" as const })),
    ...alphaMasksOf(consoleP).map((layer) => ({ layer, source: "console" as const })),
  ];
}

/**
 * Which frame an image fills. `maskId` is what the picker writes; the two
 * fallbacks keep projects made before the frames were unified working.
 */
export function resolveMask(l: Layer, masks: Layer[]): Layer | undefined {
  if (l.type !== "image" || !masks.length) return undefined;
  if (l.maskId) return masks.find((m) => m.id === l.maskId);
  // Legacy links. The frames' old numbers are kept through migration; a
  // template migrated before that keeps them by position: the main frame
  // came first, the screenshot frames after it in order.
  if (l.main) return masks.find((m) => m.mainMask) ?? masks[0];
  if (l.shot) {
    const byNumber = masks.find((m) => m.shotMask === l.shot);
    if (byNumber) return byNumber;
    const hasMain = masks.some((m) => m.mainMask) || masks.length > l.shot;
    return masks[hasMain ? l.shot : l.shot - 1] ?? masks[l.shot - 1];
  }
  return undefined;
}

// The first alpha mask a card sees — what a freshly picked cover goes into.
export async function loadMainMask(): Promise<Layer | undefined> {
  const g = await loadProject(GLOBAL_TEMPLATE_ID);
  return alphaMasksOf(g)[0];
}

// The "All consoles" logo placement frame, if one is set.
export async function loadLogoSlot(): Promise<Layer | undefined> {
  const g = await loadProject(GLOBAL_TEMPLATE_ID);
  return g?.layers.find((l) => l.logoSlot);
}
