// Project ▸ Bleed …: change how much the canvas extends past the trim.
// Layer positions are canvas px with the origin at the canvas corner, so a
// different bleed would shift every layer relative to the trim — every
// project and guide in the workspace is moved by the difference before the
// page reloads with the new geometry (src/card.ts is built at load).

import { loadGuides, saveGuides } from "./guides";
import { getBaseFormat, getFormat, setBleedOverride } from "./formats";
import { lastProjectId, loadAllProjects, mapTrash, saveProject } from "./persist";
import { PX_PER_MM } from "./card";
import type { Layer, Project } from "./types";
import { wsSuffix } from "./workspace";

// Same rounding as src/card.ts, so the shift matches the new TRIM_RECT.
const px = (mm: number) => Math.round(mm * PX_PER_MM);

export const currentBleedMM = () => getFormat().bleedMM;

export async function changeBleed(mm: number): Promise<void> {
  const from = px(currentBleedMM());
  const to = px(mm);
  const d = to - from;
  if (d !== 0) {
    const shift = (layers: Layer[]) => layers.map((l) => ({ ...l, x: l.x + d, y: l.y + d }));
    const move = (p: Project): Project => ({
      ...p,
      layers: shift(p.layers),
      back: p.back ? { ...p.back, layers: shift(p.back.layers) } : p.back,
    });
    const last = lastProjectId();
    for (const p of await loadAllProjects()) await saveProject(move(p));
    // saveProject() notes each non-template as the last one opened — undo that.
    const LAST = "lastProjectId" + wsSuffix();
    if (last) localStorage.setItem(LAST, last);
    else localStorage.removeItem(LAST);
    await mapTrash(move);
    const guides = loadGuides();
    saveGuides({ ...guides, items: guides.items.map((g) => ({ ...g, pos: g.pos + d })) });
  }
  // Back at the format's own value the override is dropped rather than kept.
  setBleedOverride(getBaseFormat().bleedMM === mm ? undefined : mm);
  location.reload();
}
