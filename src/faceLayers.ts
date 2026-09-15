// The pure part of a card's rendering: which layers a face draws, in what
// order, and which background fill it paints. Shared by the editor
// (EditorCanvas), the static renderer (CardStage) and the unit tests.

import { isAlphaMask, resolveMask } from "./templates";
import type { BackgroundLayer, CardBackground, Layer, Project } from "./types";

// One z-ordered list for a face: the project's own layers, then the
// console / global template layers it inherits (`overlay`, alpha masks
// included, in the templates' own stacking order). On a game card each
// alpha mask is where the card's own image that points at it slots in —
// spliced there as a clipped run plus a mask layer, so segmentLayers() /
// destination-in clips it, and the template's layers below the frame stay
// below the image while those above it (a frame border, say) stay above.
// The frame itself is never drawn. A template shows only its own layers
// and its own frames (editable there); the foreign frames are dropped.
// `foreignIds` names the entries that came from the overlay, so the editor
// can draw them read-only.
export function buildFaceLayers(
  project: Project,
  own: Layer[],
  overlay: Layer[] = [],
  masks: Layer[] = [],
): { layers: Layer[]; foreignIds: Set<string> } {
  const foreignIds = new Set<string>();
  const out: Layer[] = [];
  const placed = new Set<string>();
  const slotsIn = (l: Layer) => {
    if (project.isTemplate || !masks.length) return undefined;
    // A layer already wired into a hand-made mask group is left alone.
    if (!l.visible || l.mask || l.clipped) return undefined;
    return resolveMask(l, masks);
  };
  // Own content with no frame to fill sits under the whole template stack,
  // as it always has.
  for (const l of own) {
    if (!slotsIn(l)) out.push(l);
  }
  for (const tl of overlay) {
    if (!isAlphaMask(tl)) {
      out.push(tl);
      foreignIds.add(tl.id);
      continue;
    }
    const clipped = own.filter((l) => !placed.has(l.id) && slotsIn(l)?.id === tl.id);
    if (!clipped.length) continue;
    for (const l of clipped) {
      placed.add(l.id);
      out.push({ ...l, clipped: true });
    }
    const id = `__mask__${tl.id}`;
    foreignIds.add(id);
    out.push({
      ...tl,
      id,
      mask: true,
      clipped: false,
      groupTransform: false,
      main: false,
      alphaMask: false,
      mainMask: undefined,
      shotMask: undefined,
      logoSlot: false,
      locked: true,
      visible: true,
    } as Layer);
  }
  // An image whose frame isn't in the overlay (hidden, or gone) still draws,
  // unclipped, under the stack.
  for (const l of own) {
    if (slotsIn(l) && !placed.has(l.id)) out.push(l);
  }
  return { layers: out, foreignIds };
}

// The fill a background layer actually paints. The chain is card → console
// → global: a front game card with no background of its own (no layer, or
// a layer set to inherit) takes the console template's background, and
// where the console has none, the global one. A console template with no
// background likewise shows the global one. `inherit` is false for the
// back face and for templates (they only ever paint their own layer).
export function effectiveBgFill(
  bgLayer: BackgroundLayer | undefined,
  opts: {
    inherit: boolean;
    fallback?: CardBackground;
    consoleBg?: CardBackground;
    globalBg?: CardBackground;
  },
): CardBackground | null {
  const inherited = opts.consoleBg ?? opts.globalBg ?? null;
  if (!bgLayer) return opts.inherit ? inherited : (opts.fallback ?? null);
  if (!bgLayer.visible) return null;
  if (opts.inherit && (bgLayer.source ?? "card") !== "card") return inherited;
  return bgLayer.fill;
}
