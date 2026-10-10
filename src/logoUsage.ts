// Which entries of a local image library (src/localLogos.ts) the saved
// designs actually use — every console/global template and every saved card.
// Shown in their own "In use" section at the top of Settings ▸ Assets ▸ Manage logos /
// covers.
//
// Two ways a design uses one: a repeating-image pattern (src/repeatingPattern.ts)
// points at a logo by id, or an image layer holds a copy of the file. The copy
// is a data URL of the very same bytes (an inserted logo / cover isn't re-
// encoded unless it's huge), so it's found by comparing contents — first by
// byte size, so only same-sized files are ever read and compared.

import type { ImageLibrary, LocalLogo } from "./localLogos";
import { loadAllProjects } from "./persist";
import type { CardBackground, Layer, Project } from "./types";

function scanFill(fill: CardBackground | undefined, ids: Set<string>): void {
  const logoId = fill?.pattern?.logoId;
  if (fill?.pattern?.enabled && logoId) ids.add(logoId);
}

function scanLayers(layers: Layer[] | undefined, ids: Set<string>, srcs: Set<string>): void {
  for (const l of layers ?? []) {
    if (l.type === "shape" || l.type === "background") scanFill(l.fill, ids);
    if (l.type === "image" && l.src.startsWith("data:")) srcs.add(l.src);
  }
}

/** Pattern logo ids and image data URLs one design uses. */
function scanProject(p: Project): { ids: Set<string>; srcs: Set<string> } {
  const ids = new Set<string>();
  const srcs = new Set<string>();
  scanLayers(p.layers, ids, srcs);
  scanFill(p.background, ids); // legacy, pre-BackgroundLayer projects
  scanLayers(p.back?.layers, ids, srcs);
  scanFill(p.back?.background, ids);
  return { ids, srcs };
}

/** The base64 payload of a data URL and how many bytes it decodes to. */
export function dataUrlPayload(src: string): { b64: string; bytes: number } | null {
  const comma = src.indexOf(",");
  if (comma < 0 || !/;base64$/i.test(src.slice(0, comma))) return null;
  const b64 = src.slice(comma + 1);
  const pad = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
  return { b64, bytes: (b64.length * 3) / 4 - pad };
}

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((res, rej) => {
    const fr = new FileReader();
    fr.onload = () => res(fr.result as string);
    fr.onerror = () => rej(fr.error);
    fr.readAsDataURL(blob);
  });

/**
 * Library ids whose file is one of `srcs` (data URLs), by content. `read`
 * returns an entry's data URL; it's only called for entries whose size
 * matches some src.
 */
export async function matchByContent(
  entries: LocalLogo[],
  srcs: Iterable<string>,
  read: (id: string) => Promise<string | undefined>,
): Promise<Map<string, string>> {
  const bySize = new Map<number, LocalLogo[]>();
  for (const e of entries) bySize.set(e.size, [...(bySize.get(e.size) ?? []), e]);
  const hits = new Map<string, string>(); // src → library id
  const payloads = new Map<string, string>(); // id → base64, read once
  for (const src of srcs) {
    const p = dataUrlPayload(src);
    const candidates = p && bySize.get(p.bytes);
    if (!p || !candidates) continue;
    for (const e of candidates) {
      let b64 = payloads.get(e.id);
      if (b64 === undefined) {
        b64 = dataUrlPayload((await read(e.id)) ?? "")?.b64 ?? "";
        payloads.set(e.id, b64);
      }
      if (b64 && b64 === p.b64) {
        hits.set(src, e.id);
        break;
      }
    }
  }
  return hits;
}

/**
 * How many saved designs (cards and templates) use each library entry —
 * through a repeating pattern (logos only) or an image layer's copy.
 * Entries nobody uses are left out.
 */
export async function libraryUsage(lib: ImageLibrary): Promise<Map<string, number>> {
  await lib.ensureLoaded();
  const projects = (await loadAllProjects()).map(scanProject);
  const allSrcs = new Set(projects.flatMap((p) => [...p.srcs]));
  const bySrc = await matchByContent(lib.list(), allSrcs, async (id) => {
    const b = await lib.blob(id);
    return b ? blobToDataUrl(b) : undefined;
  });
  const count = new Map<string, number>();
  for (const p of projects) {
    const used = new Set<string>();
    if (lib.kind === "logo") for (const id of p.ids) used.add(id);
    for (const src of p.srcs) {
      const id = bySrc.get(src);
      if (id) used.add(id);
    }
    for (const id of used) count.set(id, (count.get(id) ?? 0) + 1);
  }
  return count;
}
