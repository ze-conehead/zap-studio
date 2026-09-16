// A template shape or background flagged `editableFill` lets the level
// right below it pick its own fill: a console overrides a global-template
// layer, a card overrides its console-template's. The override is stored
// on the descendant project (Project.fillOverrides), keyed by the
// ancestor layer's id — nothing else about the layer changes.

import type { CardBackground, Layer, Project } from "./types";

/** The fill `layer` actually paints as seen from `descendant` — its own
 * override when the layer allows one and it set one, else the layer's own
 * fill, unchanged. Layers that aren't shapes/backgrounds, or that don't
 * allow an override, pass straight through. */
export function withFillOverride(
  layer: Layer,
  descendant: Pick<Project, "fillOverrides"> | undefined,
): Layer {
  if (layer.type === "shape" || layer.type === "background") {
    if (layer.editableFill) {
      const o = descendant?.fillOverrides?.[layer.id];
      if (o) return { ...layer, fill: o };
    }
  }
  return layer;
}

/** The background layer's fill for `descendant`, honouring an override —
 * same rule as withFillOverride, kept separate since callers here only
 * ever have the resolved CardBackground, not a Layer, in hand. */
export function backgroundFillOverride(
  bg: { id: string; fill: CardBackground; editableFill?: boolean } | undefined,
  descendant: Pick<Project, "fillOverrides"> | undefined,
): CardBackground | undefined {
  if (!bg) return undefined;
  if (bg.editableFill) {
    const o = descendant?.fillOverrides?.[bg.id];
    if (o) return o;
  }
  return bg.fill;
}

/** Writes (or clears, with `fill: undefined`) one layer's override on a
 * project — the store action's implementation, also reusable by tests. */
export function setFillOverride(
  project: Project,
  layerId: string,
  fill: CardBackground | undefined,
): Project {
  const next = { ...(project.fillOverrides ?? {}) };
  if (fill) next[layerId] = fill;
  else delete next[layerId];
  return { ...project, fillOverrides: Object.keys(next).length ? next : undefined };
}
