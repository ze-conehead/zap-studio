// Catalogue for the console/game tree. Five classic consoles, each seeded
// with a widely-cited "top 5", plus a locally-persisted overlay so the user
// can add or remove games (right-click in the tree). The overlay lives in
// localStorage and is diff-shaped (added games / removed seed ids) so the
// seed list can still evolve.
// Game and console names are trademarks of their owners.

export interface CatalogGame {
  id: string;
  title: string;
}

export interface CatalogConsole {
  id: string;
  name: string;
  games: CatalogGame[];
}

const COMBINING = new RegExp("[\\u0300-\\u036f]", "g");

export const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

function make(name: string, titles: string[]): CatalogConsole {
  return {
    id: slug(name),
    name,
    games: titles.map((t) => ({ id: slug(t), title: t })),
  };
}

const SEED_CATALOG: CatalogConsole[] = [
  make("PlayStation", [
    "Gran Turismo",
    "Final Fantasy VII",
    "Metal Gear Solid",
    "Crash Bandicoot 2: Cortex Strikes Back",
    "Tekken 3",
  ]),
  make("Nintendo 64", [
    "Super Mario 64",
    "Mario Kart 64",
    "GoldenEye 007",
    "The Legend of Zelda: Ocarina of Time",
    "Super Smash Bros.",
  ]),
  make("Super Nintendo", [
    "Super Mario World",
    "The Legend of Zelda: A Link to the Past",
    "Super Mario Kart",
    "Donkey Kong Country",
    "Super Metroid",
  ]),
  make("Nintendo Entertainment System", [
    "Super Mario Bros.",
    "Super Mario Bros. 3",
    "The Legend of Zelda",
    "Metroid",
    "Mega Man 2",
  ]),
  make("Neo Geo", [
    "Metal Slug 3",
    "The King of Fighters '98",
    "Garou: Mark of the Wolves",
    "Samurai Shodown II",
    "The Last Blade 2",
  ]),
];

// ── Persisted overlay ───────────────────────────────────────────────────────

export interface CatalogOverlay {
  added: Record<string, CatalogGame[]>; // consoleId -> extra games
  removed: Record<string, string[]>; // consoleId -> hidden seed game ids
  consoleNames: Record<string, string>; // consoleId -> renamed console label
  gameTitles: Record<string, string>; // "consoleId/gameId" -> renamed game title
}

const EMPTY_OVERLAY: CatalogOverlay = {
  added: {},
  removed: {},
  consoleNames: {},
  gameTitles: {},
};

function normalizeOverlay(parsed: Partial<CatalogOverlay>): CatalogOverlay {
  return {
    added: parsed.added ?? {},
    removed: parsed.removed ?? {},
    consoleNames: parsed.consoleNames ?? {},
    gameTitles: parsed.gameTitles ?? {},
  };
}

const OVERLAY_KEY = "stickerstudio:catalogOverlay";

// The tree reads the catalogue outside React state, so it needs to know when
// a game is added/removed without a reload — same pub/sub shape as gamelist.
let version = 0;
const listeners = new Set<() => void>();

function notifyCatalogChanged() {
  version++;
  for (const l of listeners) l();
}

export function subscribeCatalog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCatalogVersion(): number {
  return version;
}

export function loadCatalogOverlay(): CatalogOverlay {
  try {
    const raw = localStorage.getItem(OVERLAY_KEY);
    if (!raw) return { ...EMPTY_OVERLAY };
    return normalizeOverlay(JSON.parse(raw) as Partial<CatalogOverlay>);
  } catch {
    return { ...EMPTY_OVERLAY };
  }
}

function saveOverlay(overlay: CatalogOverlay): void {
  try {
    localStorage.setItem(OVERLAY_KEY, JSON.stringify(overlay));
  } catch {
    /* storage full / unavailable */
  }
  notifyCatalogChanged();
}

// Replace the whole overlay (used when restoring a backup).
export function replaceCatalogOverlay(raw: string): void {
  try {
    saveOverlay(normalizeOverlay(JSON.parse(raw) as Partial<CatalogOverlay>));
  } catch {
    /* ignore malformed */
  }
}

// ── Public catalogue (seed + overlay merged) ────────────────────────────────

export function getCatalog(): CatalogConsole[] {
  const { added, removed, consoleNames, gameTitles } = loadCatalogOverlay();
  return SEED_CATALOG.map((c) => {
    const hidden = new Set(removed[c.id] ?? []);
    const seedGames = c.games
      .filter((g) => !hidden.has(g.id))
      .map((g) => ({ id: g.id, title: gameTitles[`${c.id}/${g.id}`] ?? g.title }));
    const extra = added[c.id] ?? [];
    return {
      id: c.id,
      name: consoleNames[c.id] ?? c.name,
      games: [...seedGames, ...extra],
    };
  });
}

export function findGame(gameKey: string | undefined) {
  if (!gameKey) return null;
  const [cId, gId] = gameKey.split("/");
  const catalog = getCatalog();
  const console = catalog.find((c) => c.id === cId);
  const game = console?.games.find((g) => g.id === gId);
  return console && game ? { console, game } : null;
}

export const gameKeyOf = (
  c: Pick<CatalogConsole, "id">,
  g: Pick<CatalogGame, "id">,
) => `${c.id}/${g.id}`;

// ── Mutations ───────────────────────────────────────────────────────────────

// Adds a game to a console. Returns the created (or re-shown) game, or
// undefined if the title was blank or the console id is unknown.
export function addGame(consoleId: string, rawTitle: string): CatalogGame | undefined {
  const title = rawTitle.trim();
  if (!title) return undefined;
  const seed = SEED_CATALOG.find((c) => c.id === consoleId);
  if (!seed) return undefined;

  const overlay = loadCatalogOverlay();
  const baseId = slug(title) || `spiel-${Date.now().toString(36)}`;

  // Re-adding a previously removed seed game: just un-hide it.
  const removedList = overlay.removed[consoleId] ?? [];
  if (removedList.includes(baseId)) {
    overlay.removed[consoleId] = removedList.filter((x) => x !== baseId);
    saveOverlay(overlay);
    return seed.games.find((g) => g.id === baseId);
  }

  const taken = new Set([
    ...seed.games.map((g) => g.id),
    ...(overlay.added[consoleId] ?? []).map((g) => g.id),
  ]);
  let id = baseId;
  for (let n = 2; taken.has(id); n++) id = `${baseId}-${n}`;

  const game: CatalogGame = { id, title };
  overlay.added[consoleId] = [...(overlay.added[consoleId] ?? []), game];
  saveOverlay(overlay);
  return game;
}

export function removeGame(consoleId: string, gameId: string): void {
  const overlay = loadCatalogOverlay();
  const added = overlay.added[consoleId] ?? [];
  if (added.some((g) => g.id === gameId)) {
    overlay.added[consoleId] = added.filter((g) => g.id !== gameId);
  } else {
    const hidden = new Set(overlay.removed[consoleId] ?? []);
    hidden.add(gameId);
    overlay.removed[consoleId] = [...hidden];
  }
  delete overlay.gameTitles[`${consoleId}/${gameId}`];
  saveOverlay(overlay);
}

// Renames a game (its id / gameKey stays put, so a linked design and its
// gamelist metadata keep matching). Returns false if the title was blank
// or the game id is unknown.
export function renameGame(
  consoleId: string,
  gameId: string,
  rawTitle: string,
): boolean {
  const title = rawTitle.trim();
  if (!title) return false;
  const overlay = loadCatalogOverlay();

  const custom = (overlay.added[consoleId] ?? []).find((g) => g.id === gameId);
  if (custom) {
    custom.title = title;
    saveOverlay(overlay);
    return true;
  }

  const seed = SEED_CATALOG.find((c) => c.id === consoleId)?.games.find(
    (g) => g.id === gameId,
  );
  if (!seed) return false;
  if (title === seed.title) delete overlay.gameTitles[`${consoleId}/${gameId}`];
  else overlay.gameTitles[`${consoleId}/${gameId}`] = title;
  saveOverlay(overlay);
  return true;
}

// Renames a console. The console id (and every gameKey / template / gamelist
// keyed on it) is left untouched. Returns false for a blank name or unknown id.
export function renameConsole(consoleId: string, rawName: string): boolean {
  const name = rawName.trim();
  if (!name) return false;
  const seed = SEED_CATALOG.find((c) => c.id === consoleId);
  if (!seed) return false;
  const overlay = loadCatalogOverlay();
  if (name === seed.name) delete overlay.consoleNames[consoleId];
  else overlay.consoleNames[consoleId] = name;
  saveOverlay(overlay);
  return true;
}
