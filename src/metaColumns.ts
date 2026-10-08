// The columns of the "Manage metadata" table: the built-in gamelist fields
// plus the user's own columns, and which of them are shown. Own columns keep
// their values in GameMeta.custom under the column's key — which is also
// the {placeholder} that prints it on a card. Per workspace (localStorage),
// like the gamelists themselves.

import {
  fromDateInputValue,
  loadGamelist,
  findMeta,
  saveGamelist,
  toDateInputValue,
  type GameMeta,
} from "./gamelist";
import { t } from "./i18n";
import { PLACEHOLDER_KEYS } from "./placeholders";
import { wsSuffix, type WorkspaceKind } from "./workspace";

export type ColumnKind = "text" | "long" | "date" | "rating";

export interface MetaColumn {
  key: string; // a GameMeta field, or an own column's key
  label: string;
  kind: ColumnKind;
  custom?: boolean;
}

export interface CustomColumn {
  key: string; // lower-case letters only, so "{key}" works as a placeholder
  label: string;
}

type Builtin = { key: keyof GameMeta; label: (movies: boolean) => string; kind: ColumnKind; only?: WorkspaceKind; shown?: boolean };

const BUILTIN: Builtin[] = [
  { key: "releasedate", label: () => t("Release date"), kind: "date", shown: true },
  { key: "developer", label: () => t("Developer"), kind: "text", only: "games", shown: true },
  { key: "publisher", label: () => t("Publisher"), kind: "text", only: "games", shown: true },
  { key: "director", label: () => t("Director"), kind: "text", only: "movies", shown: true },
  { key: "studio", label: () => t("Studio"), kind: "text", only: "movies", shown: true },
  { key: "genre", label: () => t("Genre"), kind: "text", shown: true },
  { key: "players", label: () => t("Players"), kind: "text", only: "games", shown: true },
  { key: "runtime", label: () => t("Runtime"), kind: "text", only: "movies", shown: true },
  { key: "rating", label: () => t("Rating"), kind: "rating", shown: true },
  { key: "desc", label: () => t("Description"), kind: "long" },
  { key: "ageRating", label: () => t("Age rating"), kind: "text" },
  { key: "series", label: (m) => (m ? t("Collection / series") : t("Series / franchise")), kind: "text" },
  { key: "altTitle", label: (m) => (m ? t("Original title") : t("Alternative title")), kind: "text" },
  { key: "tagline", label: () => t("Tagline"), kind: "text", only: "movies" },
  { key: "cast", label: () => t("Cast"), kind: "long", only: "movies" },
  { key: "country", label: () => t("Country"), kind: "text", only: "movies" },
  { key: "themes", label: (m) => (m ? t("Keywords") : t("Themes")), kind: "long" },
  { key: "modes", label: () => t("Game modes"), kind: "text", only: "games" },
  { key: "perspective", label: () => t("Perspective"), kind: "text", only: "games" },
  { key: "engine", label: () => t("Engine"), kind: "text", only: "games" },
  { key: "storyline", label: () => t("Storyline"), kind: "long", only: "games" },
  { key: "url", label: () => t("Website"), kind: "text" },
  { key: "ratingCount", label: () => t("Votes"), kind: "text" },
  { key: "image", label: () => t("Image (URL or path)"), kind: "text" },
];

const COLUMNS_KEY = () => `stickerstudio:metaColumns${wsSuffix()}`;
const HIDDEN_KEY = () => `stickerstudio:metaHidden${wsSuffix()}`;

let version = 0;
const listeners = new Set<() => void>();
const notify = () => {
  version++;
  for (const l of listeners) l();
};
export function subscribeMetaColumns(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
export const getMetaColumnsVersion = () => version;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* unavailable */
  }
  notify();
}

export function loadCustomColumns(): CustomColumn[] {
  const list = read<CustomColumn[]>(COLUMNS_KEY(), []);
  return Array.isArray(list) ? list.filter((c) => c && typeof c.key === "string" && typeof c.label === "string") : [];
}

/** Every column for this workspace kind, built-in first, then the own ones. */
export function allColumns(kind: WorkspaceKind): MetaColumn[] {
  const movies = kind === "movies";
  return [
    ...BUILTIN.filter((b) => !b.only || b.only === kind).map((b) => ({
      key: b.key,
      label: b.label(movies),
      kind: b.kind,
    })),
    ...loadCustomColumns().map((c) => ({ key: c.key, label: c.label, kind: "text" as const, custom: true })),
  ];
}

/** Hidden column keys; until the user picks, the long / rarely used ones. */
export function hiddenColumns(): Set<string> {
  const saved = read<string[] | null>(HIDDEN_KEY(), null);
  if (Array.isArray(saved)) return new Set(saved);
  return new Set(BUILTIN.filter((b) => !b.shown).map((b) => b.key));
}

export function setColumnHidden(key: string, hidden: boolean): void {
  const next = hiddenColumns();
  if (hidden) next.add(key);
  else next.delete(key);
  write(HIDDEN_KEY(), [...next]);
}

const COMBINING = new RegExp("[\\u0300-\\u036f]", "g");

/** A free key for a new column named `label`: its letters, made unique. */
export function columnKeyFor(label: string, taken: Iterable<string>): string {
  const used = new Set([...PLACEHOLDER_KEYS, ...BUILTIN.map((b) => b.key.toLowerCase()), ...taken]);
  const base =
    label
      .normalize("NFD")
      .replace(COMBINING, "")
      .replace(/ß/g, "ss")
      .toLowerCase()
      .replace(/[^a-z]/g, "") || "field";
  if (!used.has(base)) return base;
  for (const a of "bcdefghijklmnopqrstuvwxyz") if (!used.has(base + a)) return base + a;
  let k = base;
  while (used.has(k)) k += "x";
  return k;
}

export function addCustomColumn(label: string): CustomColumn | undefined {
  const name = label.trim();
  if (!name) return undefined;
  const cols = loadCustomColumns();
  const col = { key: columnKeyFor(name, cols.map((c) => c.key)), label: name };
  write(COLUMNS_KEY(), [...cols, col]);
  return col;
}

export function renameCustomColumn(key: string, label: string): void {
  const name = label.trim();
  if (!name) return;
  write(
    COLUMNS_KEY(),
    loadCustomColumns().map((c) => (c.key === key ? { ...c, label: name } : c)),
  );
}

/** Drops an own column and its values from the given consoles' gamelists. */
export function removeCustomColumn(key: string, consoleIds: string[]): void {
  write(
    COLUMNS_KEY(),
    loadCustomColumns().filter((c) => c.key !== key),
  );
  for (const id of consoleIds) {
    const games = loadGamelist(id);
    if (!games.some((g) => g.custom && key in g.custom)) continue;
    saveGamelist(
      id,
      games.map((g) => {
        if (!g.custom || !(key in g.custom)) return g;
        const { [key]: _drop, ...rest } = g.custom;
        return { ...g, custom: Object.keys(rest).length ? rest : undefined };
      }),
    );
  }
}

/** What a cell shows / edits: dates as YYYY-MM-DD, ratings out of 5. */
export function cellValue(meta: GameMeta | undefined, col: MetaColumn): string {
  if (!meta) return "";
  if (col.custom) return meta.custom?.[col.key] ?? "";
  const raw = meta[col.key as keyof GameMeta];
  const v = typeof raw === "string" ? raw : "";
  if (col.kind === "date") return toDateInputValue(v);
  if (col.kind === "rating") {
    if (!v) return "";
    const n = Number(v);
    return Number.isNaN(n) ? "" : String(+(Math.max(0, Math.min(1, n)) * 5).toFixed(2));
  }
  return v;
}

/** The gamelist patch that stores `value` in a cell ("" clears it). */
export function cellPatch(
  meta: GameMeta | undefined,
  col: MetaColumn,
  value: string,
): Partial<Omit<GameMeta, "name">> {
  const v = value.trim();
  if (col.custom) {
    const custom = { ...(meta?.custom ?? {}) };
    if (v) custom[col.key] = value;
    else delete custom[col.key];
    return { custom: Object.keys(custom).length ? custom : undefined };
  }
  if (col.kind === "date") return { [col.key]: v ? fromDateInputValue(v) ?? v : undefined };
  if (col.kind === "rating") {
    const n = Number(v.replace(",", "."));
    return { rating: v && !Number.isNaN(n) ? (Math.max(0, Math.min(5, n)) / 5).toFixed(3) : undefined };
  }
  return { [col.key]: v ? value : undefined };
}

/** Writes one cell straight to the console's gamelist. */
export function writeCell(consoleId: string, title: string, col: MetaColumn, value: string): void {
  const games = loadGamelist(consoleId);
  const meta = findMeta(games, title);
  const patch = cellPatch(meta, col, value);
  const k = title.trim().toLowerCase();
  const idx = games.findIndex((g) => g.name.trim().toLowerCase() === k);
  if (idx >= 0) games[idx] = { ...games[idx], ...patch };
  else games.push({ name: title, ...patch });
  saveGamelist(consoleId, games);
}
