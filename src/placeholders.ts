// {placeholders} in text layers, filled in per card at render time — so one
// "{title}" text in the global template puts every game's own title on its
// card. The stored layer keeps the raw text; only what's drawn (and
// measured, and exported) sees the resolved string. Unknown tokens stay as
// typed, and a template with no game to show renders them literally.

import { findGame } from "./data/catalog";
import { formatReleaseDate, ratingOutOfFive, releaseYear, type GameMeta } from "./gamelist";
import type { Project } from "./types";

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
] as const;

export type PlaceholderKey = (typeof PLACEHOLDER_KEYS)[number];

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
  }
  return undefined;
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
