// Condition layers: a metadata switch inside a card or a template.
//
// A condition names one gamelist.xml field. The layers assigned to it are
// its cases, and a case's *name* is the value it stands for — so a card for
// a fighting game draws the case named "Fighting", a racing game the one
// named "Racing". With nothing matching, the case named "Default" stands
// in. The condition layer itself never draws.

import { isCondition } from "./factory";
import { ratingOutOfFive, releaseYear, type GameMeta } from "./gamelist";
import { t } from "./i18n";
import type { ConditionField, ConditionLayer, Layer } from "./types";

export const CONDITION_FIELDS: ConditionField[] = [
  "genre",
  "developer",
  "publisher",
  "players",
  "year",
  "rating",
  "name",
];

export function fieldLabel(f: ConditionField): string {
  switch (f) {
    case "genre":
      return t("Genre");
    case "developer":
      return t("Developer");
    case "publisher":
      return t("Publisher");
    case "players":
      return t("Players");
    case "year":
      return t("Release year");
    case "rating":
      return t("Rating");
    case "name":
      return t("Title");
  }
}

/** What `field` reads as for the game a card is for. "" when unknown. */
export function metaValue(
  meta: GameMeta | undefined,
  field: ConditionField,
): string {
  switch (field) {
    case "genre":
      return meta?.genre ?? "";
    case "developer":
      return meta?.developer ?? "";
    case "publisher":
      return meta?.publisher ?? "";
    case "players":
      return meta?.players ?? "";
    case "year":
      return releaseYear(meta?.releasedate) ?? "";
    case "rating":
      return ratingOutOfFive(meta?.rating) ?? "";
    case "name":
      return meta?.name ?? "";
  }
}

// Accepted in either language, so a German project can label its fallback
// "Standard".
const DEFAULT_RE = /^(default|standard)$/i;

export const isDefaultCase = (l: Layer): boolean =>
  DEFAULT_RE.test(l.name.trim());

// gamelist genres are often lists ("Action, Fighting"), and a case may want
// to cover several values at once ("Racing, Driving"), so both sides are
// split on the usual separators.
const tokens = (s: string): string[] =>
  s
    .split(/[,/;|]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);

export function caseMatches(caseName: string, value: string): boolean {
  const whole = value.trim().toLowerCase();
  if (!whole) return false;
  const wanted = tokens(caseName);
  if (!wanted.length) return false;
  if (wanted.includes(whole)) return true;
  const have = tokens(value);
  return wanted.some((w) => have.includes(w));
}

/** The cases of `cond`, in stack order. */
export const casesOf = (layers: Layer[], cond: ConditionLayer): Layer[] =>
  layers.filter((l) => l.condId === cond.id);

/** Which of `cond`'s cases the current metadata selects. */
export function activeCases(
  layers: Layer[],
  cond: ConditionLayer,
  meta: GameMeta | undefined,
): Layer[] {
  const cases = casesOf(layers, cond);
  const value = metaValue(meta, cond.field);
  const hit = cases.filter((l) => caseMatches(l.name, value));
  return hit.length ? hit : cases.filter(isDefaultCase);
}

/** The cases no condition selects — everything that must not be drawn. */
export function hiddenCaseIds(
  layers: Layer[],
  meta: GameMeta | undefined,
): Set<string> {
  const hidden = new Set<string>();
  for (const cond of layers.filter(isCondition)) {
    const shown = new Set(activeCases(layers, cond, meta).map((l) => l.id));
    for (const l of casesOf(layers, cond)) {
      if (!shown.has(l.id)) hidden.add(l.id);
    }
  }
  return hidden;
}

/**
 * Drops the condition layers themselves and every case they don't select.
 * `keepId` survives regardless — the editor passes the selected layer, so a
 * case can be worked on even while another one is the live branch. Such a
 * kept layer is a preview only, and is left out of exports (see
 * COND_PREVIEW in src/export.ts).
 */
export function resolveConditions(
  layers: Layer[],
  meta: GameMeta | undefined,
  keepId?: string | null,
): Layer[] {
  if (!layers.some(isCondition)) return layers;
  const drop = hiddenCaseIds(layers, meta);
  if (keepId) drop.delete(keepId);
  return layers.filter((l) => !isCondition(l) && !drop.has(l.id));
}
