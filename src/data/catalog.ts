// Catalogue for the console/game tree. Five representative consoles, each
// seeded with a widely-cited "top 10", plus a locally-persisted overlay so
// the user can add or remove games (right-click in the tree). The overlay
// lives in localStorage and is diff-shaped (added games / removed seed ids)
// so the seed list can still evolve.
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
  make("Nintendo Switch", [
    "Mario Kart 8 Deluxe",
    "Animal Crossing: New Horizons",
    "Super Smash Bros. Ultimate",
    "The Legend of Zelda: Breath of the Wild",
    "Super Mario Odyssey",
    "Pokémon Schwert / Schild",
    "The Legend of Zelda: Tears of the Kingdom",
    "Pokémon Karmesin / Purpur",
    "Super Mario Party",
    "New Super Mario Bros. U Deluxe",
  ]),
  make("PlayStation 5", [
    "Marvel's Spider-Man 2",
    "God of War Ragnarök",
    "Gran Turismo 7",
    "Ratchet & Clank: Rift Apart",
    "Demon's Souls",
    "Returnal",
    "Horizon Forbidden West",
    "Final Fantasy XVI",
    "Astro's Playroom",
    "Helldivers 2",
  ]),
  make("Xbox Series X|S", [
    "Halo Infinite",
    "Forza Horizon 5",
    "Starfield",
    "Microsoft Flight Simulator",
    "Sea of Thieves",
    "Forza Motorsport",
    "Senua's Saga: Hellblade II",
    "Grounded",
    "Pentiment",
    "Hi-Fi Rush",
  ]),
  make("Nintendo 64", [
    "Super Mario 64",
    "Mario Kart 64",
    "GoldenEye 007",
    "The Legend of Zelda: Ocarina of Time",
    "Super Smash Bros.",
    "The Legend of Zelda: Majora's Mask",
    "Banjo-Kazooie",
    "Diddy Kong Racing",
    "Star Fox 64",
    "Perfect Dark",
  ]),
  make("Sega Mega Drive", [
    "Sonic the Hedgehog 2",
    "Sonic the Hedgehog",
    "Disney's Aladdin",
    "Streets of Rage 2",
    "Mortal Kombat II",
    "Gunstar Heroes",
    "Golden Axe",
    "Phantasy Star IV",
    "Sonic 3 & Knuckles",
    "Ecco the Dolphin",
  ]),
];

// ── Persisted overlay ───────────────────────────────────────────────────────

export interface CatalogOverlay {
  added: Record<string, CatalogGame[]>; // consoleId -> extra games
  removed: Record<string, string[]>; // consoleId -> hidden seed game ids
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
    if (!raw) return { added: {}, removed: {} };
    const parsed = JSON.parse(raw) as Partial<CatalogOverlay>;
    return { added: parsed.added ?? {}, removed: parsed.removed ?? {} };
  } catch {
    return { added: {}, removed: {} };
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
    const parsed = JSON.parse(raw) as Partial<CatalogOverlay>;
    saveOverlay({ added: parsed.added ?? {}, removed: parsed.removed ?? {} });
  } catch {
    /* ignore malformed */
  }
}

// ── Public catalogue (seed + overlay merged) ────────────────────────────────

export function getCatalog(): CatalogConsole[] {
  const { added, removed } = loadCatalogOverlay();
  return SEED_CATALOG.map((c) => {
    const hidden = new Set(removed[c.id] ?? []);
    const seedGames = c.games.filter((g) => !hidden.has(g.id));
    const extra = added[c.id] ?? [];
    return { ...c, games: [...seedGames, ...extra] };
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
  saveOverlay(overlay);
}
