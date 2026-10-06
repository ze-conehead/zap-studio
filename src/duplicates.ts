// The same picture on more than one card — a search that returns the same
// hits for similar titles ("Super Mario Bros." / "Super Mario Bros. 3")
// quietly puts one screenshot on both. Embedded pictures are data URLs, so
// identical bytes mean an identical string; a hash keeps the comparison
// cheap. Logos and spine backgrounds are meant to repeat and don't count.

import type { ImageLayer, Layer } from "./types";

const hashes = new Map<string, string>();

/** A short fingerprint of an image src (FNV-1a over the whole string, plus its length). */
export function imageHash(src: string): string {
  const hit = hashes.get(src);
  if (hit) return hit;
  let h = 0x811c9dc5;
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const out = `${(h >>> 0).toString(36)}:${src.length}`;
  hashes.set(src, out);
  return out;
}

export const countsAsContent = (l: Layer): l is ImageLayer =>
  l.type === "image" && !!l.src && !l.logo && !l.spineBg;

export interface PictureUse {
  key: string; // whatever identifies the card (gameKey)
  title: string;
  layerName: string;
}

/**
 * Groups of cards sharing a picture. `cards` is every card with its own
 * layers; a picture repeated within one card isn't reported.
 */
export function findDuplicates(
  cards: { key: string; title: string; layers: Layer[] }[],
): PictureUse[][] {
  const byHash = new Map<string, PictureUse[]>();
  for (const c of cards) {
    const seen = new Set<string>();
    for (const l of c.layers) {
      if (!countsAsContent(l)) continue;
      const h = imageHash(l.src);
      if (seen.has(h)) continue;
      seen.add(h);
      const list = byHash.get(h) ?? [];
      list.push({ key: c.key, title: c.title, layerName: l.name });
      byHash.set(h, list);
    }
  }
  return [...byHash.values()].filter((g) => g.length > 1);
}
