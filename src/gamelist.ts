// EmulationStation-style gamelist.xml — one per console, stored locally.
// <gameList><game><name/><desc/><image/><releasedate/><developer/>...</game></gameList>

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
}

const KEY = (consoleId: string) => `stickerstudio:gamelist:${consoleId}`;

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
}

export function clearGamelist(consoleId: string): void {
  localStorage.removeItem(KEY(consoleId));
}

function text(el: Element, tag: string): string | undefined {
  return el.querySelector(tag)?.textContent?.trim() || undefined;
}

export function parseGamelistXml(xml: string): GameMeta[] {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.querySelector("parsererror")) {
    throw new Error("Die Datei ist keine gültige gamelist.xml (XML-Fehler).");
  }
  const games = [...doc.querySelectorAll("gameList > game")];
  if (games.length === 0) {
    throw new Error("Keine <game>-Einträge in der Datei gefunden.");
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

// "20170428T000000" -> "28.04.2017"
export function formatReleaseDate(raw: string | undefined): string | undefined {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(raw ?? "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : raw;
}
