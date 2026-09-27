// Which local logos (src/localLogos.ts) a repeating-image pattern
// (src/repeatingPattern.ts) currently points at, anywhere in the library —
// every console/global template and every saved card. Used to float those
// entries to the top of "Manage logos" so the ones actually in use are easy
// to find again.

import { loadAllProjects } from "./persist";
import type { CardBackground, Layer, Project } from "./types";

function scanFill(fill: CardBackground | undefined, ids: Set<string>): void {
  const logoId = fill?.pattern?.logoId;
  if (fill?.pattern?.enabled && logoId) ids.add(logoId);
}

function scanLayers(layers: Layer[] | undefined, ids: Set<string>): void {
  for (const l of layers ?? []) {
    if (l.type === "shape" || l.type === "background") scanFill(l.fill, ids);
  }
}

function scanProject(p: Project, ids: Set<string>): void {
  scanLayers(p.layers, ids);
  scanFill(p.background, ids); // legacy, pre-BackgroundLayer projects
  scanLayers(p.back?.layers, ids);
  scanFill(p.back?.background, ids);
}

/** The set of local logo ids referenced by an enabled repeating pattern
 * anywhere in the saved library (every template and card). */
export async function usedLogoIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  const projects = await loadAllProjects();
  for (const p of projects) scanProject(p, ids);
  return ids;
}
