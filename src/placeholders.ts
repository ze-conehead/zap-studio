// {placeholders} in text layers, filled in per card at render time — so one
// "{title}" text in the global template puts every game's own title on its
// card. The stored layer keeps the raw text; only what's drawn (and
// measured, and exported) sees the resolved string. Unknown tokens stay as
// typed, and a template with no game to show renders them literally.

import { findGame } from "./data/catalog";
import { formatReleaseDate, ratingOutOfFive, releaseYear, type GameMeta } from "./gamelist";
import { t } from "./i18n";
import type { Project } from "./types";
import type { WorkspaceKind } from "./workspace";

export interface PlaceholderContext {
  title?: string; // the game / movie
  console?: string; // its console / collection
  index?: number; // 1-based position in the console
  count?: number; // games in the console
  meta?: GameMeta;
}

export const PLACEHOLDER_KEYS = [
  "title",
  "console",
  "index",
  "count",
  "year",
  "date",
  "genre",
  "developer",
  "publisher",
  "players",
  "rating",
  "director",
  "studio",
  "runtime",
  "desc",
  "age",
  "series",
  "alt",
  "tagline",
  "cast",
  "country",
  "themes",
  "modes",
  "perspective",
  "engine",
  "storyline",
  "url",
  "votes",
] as const;

export type PlaceholderKey = (typeof PLACEHOLDER_KEYS)[number];

// Keys that only mean something for one workspace kind.
const GAMES_ONLY: PlaceholderKey[] = ["developer", "publisher", "players", "modes", "perspective", "engine", "storyline"];
const MOVIES_ONLY: PlaceholderKey[] = ["director", "studio", "runtime", "tagline", "cast", "country"];

export function placeholderKeysFor(kind: WorkspaceKind): PlaceholderKey[] {
  const hidden = kind === "movies" ? GAMES_ONLY : MOVIES_ONLY;
  return PLACEHOLDER_KEYS.filter((k) => !hidden.includes(k));
}

// Human label for a key, as the picker and the Metadata layer show it.
export function placeholderLabel(key: PlaceholderKey, kind: WorkspaceKind): string {
  const movies = kind === "movies";
  switch (key) {
    case "title": return t("Title");
    case "console": return movies ? t("Collection") : t("Console");
    case "index": return movies ? t("Number in collection") : t("Number in console");
    case "count": return movies ? t("Movies in collection") : t("Games in console");
    case "year": return t("Release year");
    case "date": return t("Release date");
    case "genre": return t("Genre");
    case "developer": return t("Developer");
    case "publisher": return t("Publisher");
    case "players": return t("Players");
    case "rating": return t("Rating");
    case "director": return t("Director");
    case "studio": return t("Studio");
    case "runtime": return t("Runtime");
    case "desc": return t("Description");
    case "age": return t("Age rating");
    case "series": return movies ? t("Collection / series") : t("Series / franchise");
    case "alt": return movies ? t("Original title") : t("Alternative title");
    case "tagline": return t("Tagline");
    case "cast": return t("Cast");
    case "country": return t("Country");
    case "themes": return movies ? t("Keywords") : t("Themes");
    case "modes": return t("Game modes");
    case "perspective": return t("Perspective");
    case "engine": return t("Engine");
    case "storyline": return t("Storyline");
    case "url": return t("Website");
    case "votes": return t("Votes");
  }
}

export const hasPlaceholders = (text: string) => /\{[a-z]+\}/i.test(text);

function value(key: string, ctx: PlaceholderContext): string | undefined {
  const m = ctx.meta;
  switch (key) {
    case "title":
      return ctx.title ?? m?.name;
    case "console":
      return ctx.console;
    case "index":
      return ctx.index !== undefined ? String(ctx.index) : undefined;
    case "count":
      return ctx.count !== undefined ? String(ctx.count) : undefined;
    case "year":
      return releaseYear(m?.releasedate);
    case "date":
      return formatReleaseDate(m?.releasedate);
    case "genre":
      return m?.genre;
    case "developer":
      return m?.developer;
    case "publisher":
      return m?.publisher;
    case "players":
      return m?.players;
    case "rating":
      return ratingOutOfFive(m?.rating);
    case "director":
      return m?.director;
    case "studio":
      return m?.studio;
    case "runtime":
      return m?.runtime;
    case "desc":
      return m?.desc;
    case "age":
      return m?.ageRating;
    case "series":
      return m?.series;
    case "alt":
      return m?.altTitle;
    case "tagline":
      return m?.tagline;
    case "cast":
      return m?.cast;
    case "country":
      return m?.country;
    case "themes":
      return m?.themes;
    case "modes":
      return m?.modes;
    case "perspective":
      return m?.perspective;
    case "engine":
      return m?.engine;
    case "storyline":
      return m?.storyline;
    case "url":
      return m?.url;
    case "votes":
      return m?.ratingCount;
  }
  return undefined;
}

/** The value one placeholder key resolves to, or undefined when unknown. */
export function placeholderValue(key: PlaceholderKey, ctx: PlaceholderContext | undefined) {
  return ctx ? value(key, ctx) : undefined;
}

export function resolvePlaceholders(text: string, ctx: PlaceholderContext | undefined): string {
  if (!ctx || !hasPlaceholders(text)) return text;
  return text.replace(/\{([a-z]+)\}/gi, (whole, key: string) => {
    const v = value(key.toLowerCase(), ctx);
    return v === undefined ? whole : v;
  });
}

/**
 * The context for a project as the editor / renderer sees it. A game card
 * resolves against its catalogue entry; a console template previews with
 * the first gamelist entry (the same one its metadata badges preview with),
 * so "{title}" reads as a real title while designing; the global template
 * has nothing to show and keeps the tokens literal.
 */
export function placeholderContextFor(
  project: Project,
  meta: GameMeta | undefined,
): PlaceholderContext {
  const found = findGame(project.gameKey);
  if (found) {
    const i = found.console.games.findIndex((g) => g.id === found.game.id);
    return {
      title: found.game.title,
      console: found.console.name,
      index: i >= 0 ? i + 1 : undefined,
      count: found.console.games.length,
      meta,
    };
  }
  if (project.isTemplate && !project.isGlobalTemplate) {
    return { title: meta?.name, console: project.consoleName, meta };
  }
  if (project.isGlobalTemplate) return { meta };
  // An unlinked design: its own name is all there is.
  return { title: project.name, console: project.consoleName, meta };
}
