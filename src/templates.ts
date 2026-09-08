import { GLOBAL_TEMPLATE_ID } from "./factory";
import { loadProject } from "./persist";
import type { Layer, Project } from "./types";

/** An alpha mask plus where it came from, for the card's mask picker. */
export interface MaskOption {
  layer: Layer;
  source: "global" | "console";
}

const isAlphaMask = (l: Layer) => !!(l.alphaMask || l.mainMask || l.shotMask);

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
  if (l.main) return masks[0];
  if (l.shot) return masks[l.shot - 1];
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
