// EmulationStation-style gamelist.xml — one per console, stored locally.
// <gameList><game><name/><desc/><image/><releasedate/><developer/>...</game></gameList>

import { t } from "./i18n";
import { findGame } from "./data/catalog";
import { wsSuffix } from "./workspace";
import type { Project } from "./types";

export interface GameMeta {
  name: string;
  path?: string;
  desc?: string;
  image?: string;
  releasedate?: string; // "YYYYMMDDTHHmmss"
  developer?: string;
  publisher?: string;
  genre?: string;
  players?: string;
  rating?: string; // "0".."1"
  // Movies-workspace fields — a movie's entry uses these instead of
  // developer/publisher/players.
  director?: string;
  studio?: string;
  runtime?: string; // free text, e.g. "118 min"
}

// Namespaced per workspace ("" suffix for the original), so a project's
// metadata stays with that project. `seedWorkspace` writes the same shape.
const KEY = (consoleId: string) =>
  `stickerstudio:gamelist:${consoleId}${wsSuffix()}`;

// gamelist.xml lives outside React state (plain localStorage), but layers
// like MetaBadge need to redraw the instant a list is uploaded/removed —
// even without navigating away. A minimal external-store pub/sub lets
// components opt into that via useSyncExternalStore.
let version = 0;
const listeners = new Set<() => void>();

function notifyGamelistsChanged() {
  version++;
  for (const l of listeners) l();
}

export function subscribeGamelists(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getGamelistVersion(): number {
  return version;
}

export function loadGamelist(consoleId: string): GameMeta[] {
  try {
    const raw = localStorage.getItem(KEY(consoleId));
    return raw ? (JSON.parse(raw) as GameMeta[]) : [];
  } catch {
    return [];
  }
}

export function saveGamelist(consoleId: string, games: GameMeta[]): void {
  try {
    localStorage.setItem(KEY(consoleId), JSON.stringify(games));
  } catch {
    /* storage full / unavailable */
  }
  notifyGamelistsChanged();
}

export function clearGamelist(consoleId: string): void {
  localStorage.removeItem(KEY(consoleId));
  notifyGamelistsChanged();
}

function text(el: Element, tag: string): string | undefined {
  return el.querySelector(tag)?.textContent?.trim() || undefined;
}

export function parseGamelistXml(xml: string): GameMeta[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error(t("The file is not a valid gamelist.xml (XML error)."));
  }
  const games = [...doc.querySelectorAll("gameList > game")];
  if (games.length === 0) {
    throw new Error(t("No <game> entries found in the file."));
  }
  return games
    .map((g) => ({
      name: text(g, "name") ?? "",
      path: text(g, "path"),
      desc: text(g, "desc"),
      image: text(g, "image"),
      releasedate: text(g, "releasedate"),
      developer: text(g, "developer"),
      publisher: text(g, "publisher"),
      genre: text(g, "genre"),
      players: text(g, "players"),
      rating: text(g, "rating"),
    }))
    .filter((g) => g.name);
}

// Match by title, the same way the console/game tree names things.
export function findMeta(games: GameMeta[], title: string): GameMeta | undefined {
  const t = title.trim().toLowerCase();
  return games.find((g) => g.name.trim().toLowerCase() === t);
}

// Create-or-update the entry for `title`. Used by the editable Metadata
// panel so a game can get its own gamelist entry without an XML upload.
export function upsertGameMeta(
  consoleId: string,
  title: string,
  patch: Partial<Omit<GameMeta, "name">>,
): void {
  const games = loadGamelist(consoleId);
  const t = title.trim().toLowerCase();
  const idx = games.findIndex((g) => g.name.trim().toLowerCase() === t);
  if (idx >= 0) {
    games[idx] = { ...games[idx], ...patch };
  } else {
    games.push({ name: title, ...patch });
  }
  saveGamelist(consoleId, games);
}

// Batch upsert (base-game-list import): one load + one save per console.
export function upsertGameMetaMany(
  consoleId: string,
  entries: (Partial<Omit<GameMeta, "name">> & { name: string })[],
): void {
  const games = loadGamelist(consoleId);
  const byName = new Map(games.map((g, i) => [g.name.trim().toLowerCase(), i]));
  for (const e of entries) {
    const { name, ...patch } = e;
    const k = name.trim().toLowerCase();
    const idx = byName.get(k);
    if (idx !== undefined) games[idx] = { ...games[idx], ...patch };
    else {
      byName.set(k, games.length);
      games.push({ name, ...patch });
    }
  }
  saveGamelist(consoleId, games);
}

export function removeGameMeta(consoleId: string, title: string): void {
  const games = loadGamelist(consoleId);
  const t = title.trim().toLowerCase();
  saveGamelist(
    consoleId,
    games.filter((g) => g.name.trim().toLowerCase() !== t),
  );
}

// Keeps a gamelist entry attached to its game after the game is renamed in
// the tree (metadata is matched by title). No-op if there's no entry.
export function renameGameMeta(
  consoleId: string,
  oldTitle: string,
  newTitle: string,
): void {
  const games = loadGamelist(consoleId);
  const t = oldTitle.trim().toLowerCase();
  const idx = games.findIndex((g) => g.name.trim().toLowerCase() === t);
  if (idx < 0) return;
  games[idx] = { ...games[idx], name: newTitle };
  saveGamelist(consoleId, games);
}

// "20170428T000000" -> "2017-04-28" (for <input type="date">)
export function toDateInputValue(raw: string | undefined): string {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw ?? "");
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

// "2017-04-28" -> "20170428T000000"
export function fromDateInputValue(value: string): string | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? `${m[1]}${m[2]}${m[3]}T000000` : undefined;
}

// "20170428T000000" -> "28.04.2017"
export function formatReleaseDate(raw: string | undefined): string | undefined {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw ?? "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : raw;
}

// "20170428T000000" -> "2017"
export function releaseYear(raw: string | undefined): string | undefined {
  const m = /^(\d{4})/.exec(raw ?? "");
  return m ? m[1] : undefined;
}

// "0.92" -> "4.6" (gamelist ratings are 0..1, shown here out of 5 stars)
export function ratingOutOfFive(raw: string | undefined): string | undefined {
  if (raw === undefined) return undefined;
  const v = Number(raw);
  if (Number.isNaN(v)) return undefined;
  return (Math.max(0, Math.min(1, v)) * 5).toFixed(1);
}

// The metadata a "MetaBadge" layer shows for the current view:
// - an open game card → its real gamelist.xml entry (if matched)
// - a console template being edited → the first entry of its gamelist, as
//   a live preview so the badge isn't blank while you design it
// - anything else (global template, unlinked project, no data) → undefined
export function resolveBadgeMeta(project: Project): GameMeta | undefined {
  const found = findGame(project.gameKey);
  if (found) {
    const games = loadGamelist(found.console.id);
    return findMeta(games, found.game.title);
  }
  if (project.isTemplate && project.consoleId) {
    const games = loadGamelist(project.consoleId);
    if (games.length > 0) return games[0];
  }
  return undefined;
}
