// The pure part of a card's rendering: which layers a face draws, in what
// order, and which background fill it paints. Shared by the editor
// (EditorCanvas), the static renderer (CardStage) and the unit tests.

import { isBackground } from "./factory";
import { withFillOverride } from "./fillOverrides";
import { applySpine, type SpineSlice } from "./spine";
import { isAlphaMask, resolveMask } from "./templates";
import type { BackgroundLayer, CardBackground, Layer, Project } from "./types";

// A console's own overlay-eligible layers plus the global template's, one
// z-ordered list (global on top — see buildFaceLayers) for a game card to
// draw. The console's logo image (Manage Logos / "Find logo", ImageLayer
// with `logo: true`) is the one console layer that doesn't just land below
// the whole global stack: it slots into the global template's own logo
// frame (`logoSlot`, never drawn itself) at that frame's own position, so
// where the template author put the frame in their stack — above a
// decorative shape, say — is where the logo actually draws. A console
// layer dragged above a specific global layer while editing the console
// template directly (`stackAfterId`, the same mechanism buildFaceLayers
// uses for an own layer anchored to an overlay one) keeps that position
// here too, instead of always sitting under the whole global stack — a
// console template is itself an "own vs. overlay=global" pair the same
// way a card is, so the anchor it recorded still names a real global
// layer once this flattens the two into one list for the card.
export function buildOverlay(
  consoleP: Project | undefined,
  descendantOfConsole: Project | undefined,
  globalP: Project | undefined,
  descendantOfGlobal: Project | undefined,
  // Which spine of the console this card is, for a "Spine background" layer.
  spine: SpineSlice = { index: 0, count: 1 },
): Layer[] {
  const overlayable = (p: Project | undefined, descendant: Project | undefined) =>
    (p?.layers ?? [])
      .filter((l) => !l.logoSlot && !isBackground(l))
      .map((l) => withFillOverride(l, descendant));

  const logo = consoleP?.layers.find((l) => l.type === "image" && l.logo);
  const consoleLayers = applySpine(
    overlayable(consoleP, descendantOfConsole).filter((l) => l.id !== logo?.id),
    spine,
  );
  const globalLayers = (globalP?.layers ?? []).flatMap((l): Layer[] => {
    if (isBackground(l)) return [];
    if (l.logoSlot) return logo ? [withFillOverride(logo, descendantOfConsole)] : [];
    return [withFillOverride(l, descendantOfGlobal)];
  });

  const globalIds = new Set(globalLayers.map((l) => l.id));
  const anchored = (l: Layer) =>
    !l.mask && !l.clipped && !!l.stackAfterId && globalIds.has(l.stackAfterId);
  const anchoredAt = (id: string) => consoleLayers.filter((l) => anchored(l) && l.stackAfterId === id);

  const out: Layer[] = consoleLayers.filter((l) => !anchored(l));
  for (const gl of globalLayers) {
    out.push(gl);
    out.push(...anchoredAt(gl.id));
  }
  return out;
}

// One z-ordered list for a face: the project's own layers, then the
// console / global template layers it inherits (`overlay`, alpha masks
// included, in the templates' own stacking order) — except an own layer
// with `stackAfterId` set, which slots in right above that overlay layer
// instead (dragged there in the Layers panel). On a game card each
// alpha mask is where the card's own image that points at it slots in —
// spliced there as a clipped run plus a mask layer, so segmentLayers() /
// destination-in clips it, and the template's layers below the frame stay
// below the image while those above it (a frame border, say) stay above.
// The frame itself is never drawn. A template shows only its own layers
// and its own frames (editable there); the foreign frames are dropped.
// `foreignIds` names the entries that came from the overlay, so the editor
// can draw them read-only.
//
// A console template being edited directly sees its own logo image the
// same way: `own` is the console's own layers (the logo among them, still
// fully editable — never added to foreignIds), `overlay` is the global
// template's, logoSlot included this time so its own stacking position is
// there to slot the logo into. A game card never has this happen twice —
// buildOverlay() already resolves the console/global logoSlot splice
// before either side ever reaches here, so by the time `own`/`overlay`
// arrive for a card, no logoSlot layer is left in `overlay` to match.
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
  const logoLayer = own.find((l) => l.type === "image" && l.logo && l.visible);
  // An own layer with `stackAfterId` set (dragged there in the Layers
  // panel — see LayerList.tsx) draws immediately above that overlay
  // layer instead of under the whole stack. A layer clipped into a mask
  // ignores it — that position always wins — and so does a stale id that
  // no longer names a layer actually in this overlay.
  const overlayIds = new Set(overlay.map((l) => l.id));
  const anchored = (l: Layer) =>
    !l.mask && !l.clipped && !!l.stackAfterId && overlayIds.has(l.stackAfterId);
  const anchoredAt = (id: string) =>
    own.filter((l) => l.id !== logoLayer?.id && !slotsIn(l) && anchored(l) && l.stackAfterId === id);

  // Own content with no frame to fill and no stacking anchor sits under
  // the whole template stack, as it always has.
  for (const l of own) {
    if (!slotsIn(l) && l.id !== logoLayer?.id && !anchored(l)) out.push(l);
  }
  for (const tl of overlay) {
    if (tl.logoSlot) {
      if (logoLayer) {
        placed.add(logoLayer.id);
        out.push(logoLayer);
      }
      out.push(...anchoredAt(tl.id));
      continue;
    }
    if (!isAlphaMask(tl)) {
      out.push(tl);
      foreignIds.add(tl.id);
      out.push(...anchoredAt(tl.id));
      continue;
    }
    const clipped = own.filter((l) => !placed.has(l.id) && slotsIn(l)?.id === tl.id);
    if (clipped.length) {
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
    out.push(...anchoredAt(tl.id));
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
