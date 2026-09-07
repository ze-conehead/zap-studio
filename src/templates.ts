import { GLOBAL_TEMPLATE_ID } from "./factory";
import { loadProject } from "./persist";
import type { Layer } from "./types";

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
