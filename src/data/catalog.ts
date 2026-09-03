// Example catalogue for the console/game tree. Five representative consoles,
// each with a widely-cited "top 10" of notable / best-selling titles.
// Purely reference data — game and console names are trademarks of their owners.

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

const slug = (s: string) =>
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

export const CATALOG: CatalogConsole[] = [
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

export function findGame(gameKey: string | undefined) {
  if (!gameKey) return null;
  const [cId, gId] = gameKey.split("/");
  const console = CATALOG.find((c) => c.id === cId);
  const game = console?.games.find((g) => g.id === gId);
  return console && game ? { console, game } : null;
}

export const gameKeyOf = (c: CatalogConsole, g: CatalogGame) => `${c.id}/${g.id}`;
