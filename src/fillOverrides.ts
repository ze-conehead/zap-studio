// Every template shape or background lets the level right below it pick
// its own look: a console overrides a global-template layer, a card
// overrides its console-template's. The override is stored on the
// descendant project (Project.fillOverrides), keyed by the ancestor
// layer's id — geometry, combine, etc. always stay inherited as-is.

import type { CardBackground, Layer, LayerStyleOverride, Project } from "./types";

/** `layer` as seen from `descendant` — its own fill/stroke picks merged
 * over the layer's own, for whichever fields it set. Layers that aren't
 * shapes/backgrounds pass straight through. */
export function withFillOverride(
  layer: Layer,
  descendant: Pick<Project, "fillOverrides"> | undefined,
): Layer {
  const o = descendant?.fillOverrides?.[layer.id];
  if (!o) return layer;
  if (layer.type === "background") {
    return o.fill ? { ...layer, fill: o.fill } : layer;
  }
  if (layer.type === "shape") {
    return {
      ...layer,
      fill: o.fill ?? layer.fill,
      stroke: o.stroke ?? layer.stroke,
      strokeWidth: o.strokeWidth ?? layer.strokeWidth,
    };
  }
  return layer;
}

/** The background layer's fill for `descendant`, honouring an override —
 * same rule as withFillOverride, kept separate since callers here only
 * ever have the resolved CardBackground, not a Layer, in hand. */
export function backgroundFillOverride(
  bg: { id: string; fill: CardBackground } | undefined,
  descendant: Pick<Project, "fillOverrides"> | undefined,
): CardBackground | undefined {
  if (!bg) return undefined;
  return descendant?.fillOverrides?.[bg.id]?.fill ?? bg.fill;
}

/** Merges `patch` into one layer's override on a project (or clears it
 * entirely, with `patch: undefined`) — the store action's implementation,
 * also reusable by tests. */
export function setFillOverride(
  project: Project,
  layerId: string,
  patch: LayerStyleOverride | undefined,
): Project {
  const next = { ...(project.fillOverrides ?? {}) };
  if (patch === undefined) delete next[layerId];
  else next[layerId] = { ...next[layerId], ...patch };
  return { ...project, fillOverrides: Object.keys(next).length ? next : undefined };
}
