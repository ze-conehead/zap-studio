import { GLOBAL_TEMPLATE_ID } from "./factory";
import { loadProject } from "./persist";
import type { Layer, Project } from "./types";

/** Screenshot frames of one project, lowest number first. */
export function shotMasksOf(p: Project | undefined): Layer[] {
  return (p?.layers ?? [])
    .filter((l) => l.shotMask && l.visible)
    .sort((a, b) => (a.shotMask ?? 0) - (b.shotMask ?? 0));
}

/**
 * The screenshot frames a card sees: the global template's, overridden per
 * number by the console's own, so a console can place them differently.
 */
export function mergeShotMasks(global: Layer[], own: Layer[]): Layer[] {
  const by = new Map<number, Layer>();
  for (const l of global) by.set(l.shotMask!, l);
  for (const l of own) by.set(l.shotMask!, l);
  return [...by.values()].sort((a, b) => (a.shotMask ?? 0) - (b.shotMask ?? 0));
}

// The "All consoles" main alpha mask layer, if one is set.
export async function loadMainMask(): Promise<Layer | undefined> {
  const g = await loadProject(GLOBAL_TEMPLATE_ID);
  return g?.layers.find((l) => l.mainMask && l.visible);
}

// The "All consoles" logo placement frame, if one is set.
export async function loadLogoSlot(): Promise<Layer | undefined> {
  const g = await loadProject(GLOBAL_TEMPLATE_ID);
  return g?.layers.find((l) => l.logoSlot);
}
