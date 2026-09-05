// The bundled "base game list" (base_game_list.csv): a curated top-N per
// console with year / publisher / players / genre / rating. Used by the
// "Basis-Set" import to seed the console/game tree plus gamelist metadata.

import type { GameMeta } from "../gamelist";
import raw from "./base_game_list.csv?raw";

export interface BaseGame {
  console: string;
  game: string;
  year: string;
  publisher: string;
  players: string;
  genre: string;
  rating: string; // 0..10, as written in the file
}

export interface BaseConsole {
  name: string;
  games: BaseGame[];
}

// RFC-4180-ish parser: handles quoted fields and embedded commas / quotes.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") endField();
    else if (c === "\n") endRow();
    else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) endRow();
  return rows;
}

let cache: BaseConsole[] | null = null;

export function baseConsoles(): BaseConsole[] {
  if (cache) return cache;
  const rows = parseCsv(raw);
  const header = (rows[0] ?? []).map((h) => h.trim());
  const col = (name: string) => header.indexOf(name);
  const ci = col("console");
  const gi = col("game");

  const map = new Map<string, BaseGame[]>();
  for (const r of rows.slice(1)) {
    const consoleName = r[ci]?.trim();
    const game = r[gi]?.trim();
    if (!consoleName || !game) continue;
    const entry: BaseGame = {
      console: consoleName,
      game,
      year: r[col("year")]?.trim() ?? "",
      publisher: r[col("publisher")]?.trim() ?? "",
      players: r[col("players")]?.trim() ?? "",
      genre: r[col("genre")]?.trim() ?? "",
      rating: r[col("rating")]?.trim() ?? "",
    };
    if (!map.has(consoleName)) map.set(consoleName, []);
    map.get(consoleName)!.push(entry);
  }

  cache = [...map.entries()].map(([name, games]) => ({ name, games }));
  return cache;
}

// A CSV row -> gamelist.xml entry patch (no name; the caller adds it).
export function toMeta(g: BaseGame): Partial<Omit<GameMeta, "name">> {
  const year = /^\d{4}$/.test(g.year) ? g.year : undefined;
  const r = Number(g.rating);
  return {
    releasedate: year ? `${year}0101T000000` : undefined,
    publisher: g.publisher || undefined,
    players: g.players || undefined,
    genre: g.genre || undefined,
    rating: Number.isFinite(r) ? (r / 10).toFixed(2) : undefined,
  };
}
