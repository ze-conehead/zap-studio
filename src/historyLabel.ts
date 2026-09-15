// A one-line label for the step between two project snapshots, for the
// undo history list. Snapshots carry no action name — the difference is
// read off the layer stacks instead, which also covers everything that
// goes through the reducer in one go.

import { t } from "./i18n";
import type { Layer, Project } from "./types";

const MOVE = new Set(["x", "y"]);
const SIZE = new Set(["width", "height", "scaleX", "scaleY"]);

function changedKeys(a: Layer, b: Layer): string[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: string[] = [];
  for (const k of keys) {
    const x = (a as unknown as Record<string, unknown>)[k];
    const y = (b as unknown as Record<string, unknown>)[k];
    if (x === y) continue;
    if (typeof x === "object" && typeof y === "object" && JSON.stringify(x) === JSON.stringify(y)) continue;
    out.push(k);
  }
  return out;
}

function describeLayers(before: Layer[], after: Layer[]): string | undefined {
  const b = new Map(before.map((l) => [l.id, l]));
  const a = new Map(after.map((l) => [l.id, l]));
  const added = after.filter((l) => !b.has(l.id));
  const removed = before.filter((l) => !a.has(l.id));
  if (added.length && !removed.length) {
    return added.length === 1 ? t("Added “{name}”", { name: added[0].name }) : t("Added {n} layers", { n: added.length });
  }
  if (removed.length && !added.length) {
    return removed.length === 1 ? t("Removed “{name}”", { name: removed[0].name }) : t("Removed {n} layers", { n: removed.length });
  }
  if (added.length && removed.length) return t("Replaced layers");

  const changed = after.filter((l) => b.get(l.id) !== l && changedKeys(b.get(l.id)!, l).length);
  if (!changed.length) {
    const order = before.map((l) => l.id).join();
    return order === after.map((l) => l.id).join() ? undefined : t("Reordered layers");
  }
  if (changed.length > 1) return t("Changed {n} layers", { n: changed.length });

  const l = changed[0];
  const keys = changedKeys(b.get(l.id)!, l);
  const name = l.name;
  const only = (set: Set<string>) => keys.every((k) => set.has(k));
  if (keys.length === 1) {
    const k = keys[0];
    if (k === "name") return t("Renamed to “{name}”", { name });
    if (k === "visible") return l.visible ? t("Showed “{name}”", { name }) : t("Hid “{name}”", { name });
    if (k === "locked") return l.locked ? t("Locked “{name}”", { name }) : t("Unlocked “{name}”", { name });
    if (k === "text") return t("Edited text of “{name}”", { name });
    if (k === "rotation") return t("Rotated “{name}”", { name });
    if (k === "opacity") return t("Opacity of “{name}”", { name });
    if (k === "src") return t("Swapped image of “{name}”", { name });
  }
  if (only(MOVE)) return t("Moved “{name}”", { name });
  if (only(SIZE) || only(new Set([...SIZE, ...MOVE]))) return t("Resized “{name}”", { name });
  return t("Changed “{name}”", { name });
}

export function describeChange(before: Project, after: Project): string {
  if (before.name !== after.name) return t("Renamed to “{name}”", { name: after.name });
  if (!before.back && after.back) return t("Added the back side");
  if (before.back && !after.back) return t("Removed the back side");
  return (
    describeLayers(before.layers, after.layers) ??
    (before.back && after.back ? describeLayers(before.back.layers, after.back.layers) : undefined) ??
    t("Other change")
  );
}
