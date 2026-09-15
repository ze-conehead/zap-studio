import { beforeEach, describe, expect, it, vi } from "vitest";

// Only the network is stubbed: normalizeTitle & co. stay real.
const igdb = vi.fn();
const tmdb = vi.fn();
vi.mock("./covers", async (importOriginal) => {
  const real = await importOriginal<typeof import("./covers")>();
  return {
    ...real,
    isConfigured: () => true,
    igdbFetch: (...a: unknown[]) => igdb(...a),
    tmdbFetch: (...a: unknown[]) => tmdb(...a),
  };
});

import { fetchGameMeta, fetchMovieMeta } from "./metaFetch";

const arcade = {
  id: 1,
  name: "Tekken 3",
  first_release_date: 859334400,
  platforms: [{ name: "Arcade", abbreviation: "Arcade" }],
  rating: 88,
  rating_count: 400,
  summary: "Arcade version",
};
const ps = {
  id: 2,
  name: "Tekken 3",
  first_release_date: 890956800,
  genres: [{ name: "Fighting" }],
  platforms: [{ name: "PlayStation", abbreviation: "PS1" }],
  involved_companies: [
    { developer: true, company: { name: "Namco" } },
    { publisher: true, company: { name: "Namco" } },
    { publisher: true, company: { name: "Sony Computer Entertainment" } },
  ],
  rating: 90.5,
  aggregated_rating: 92.1,
  rating_count: 812,
  aggregated_rating_count: 7,
  summary: "PS summary",
  storyline: "The King of Iron Fist Tournament 3",
  franchises: [{ name: "Tekken" }],
  collections: [{ name: "Tekken (Series)" }],
  themes: [{ name: "Action" }, { name: "Martial Arts" }],
  game_modes: [{ name: "Single player" }, { name: "Multiplayer" }],
  player_perspectives: [{ name: "Side view" }],
  alternative_names: [{ name: "Tekken 3" }, { name: "鉄拳3" }],
  websites: [
    { url: "https://en.wikipedia.org/wiki/Tekken_3", type: { type: "Wikipedia" } },
    { url: "https://www.bandainamcoent.com/tekken", type: { type: "Official" } },
  ],
  age_ratings: [
    { organization: { name: "ESRB" }, rating_category: { rating: "T" } },
    { organization: { name: "PEGI" }, rating_category: { rating: "Sixteen" } },
    { organization: { name: "USK" }, rating_category: { rating: "16" } },
  ],
  multiplayer_modes: [{ offlinemax: 2, splitscreen: false }],
};

beforeEach(() => {
  igdb.mockReset();
  tmdb.mockReset();
});

describe("fetchGameMeta (IGDB)", () => {
  it("prefers the exact title released on the card's console and maps every field", async () => {
    igdb.mockResolvedValue([arcade, ps]);
    const out = await fetchGameMeta("Tekken 3", "PlayStation");
    expect(igdb.mock.calls[0][0]).toBe("games");
    expect(igdb.mock.calls[0][1]).toMatch(/^search "Tekken 3"; fields .*age_ratings\.organization\.name/);
    expect(out).toEqual({
      releasedate: "19980327T000000",
      genre: "Fighting",
      developer: "Namco",
      publisher: "Namco, Sony Computer Entertainment",
      rating: "0.921",
      ratingCount: "7",
      desc: "PS summary",
      storyline: "The King of Iron Fist Tournament 3",
      players: "1-2",
      ageRating: "USK 16",
      series: "Tekken",
      url: "https://www.bandainamcoent.com/tekken",
      altTitle: "鉄拳3",
      themes: "Action, Martial Arts",
      modes: "Single player, Multiplayer",
      perspective: "Side view",
    });
  });

  it("falls back to the first exact match without a console, then to the first hit", async () => {
    igdb.mockResolvedValue([arcade, ps]);
    expect((await fetchGameMeta("Tekken 3")).desc).toBe("Arcade version");
    igdb.mockResolvedValue([{ id: 9, name: "Tekken 3: Special", summary: "only hit" }]);
    expect((await fetchGameMeta("Tekken 3")).desc).toBe("only hit");
  });

  it("spells out PEGI words and falls back to any organisation", async () => {
    igdb.mockResolvedValue([{ ...ps, age_ratings: [{ organization: { name: "PEGI" }, rating_category: { rating: "Twelve" } }] }]);
    expect((await fetchGameMeta("Tekken 3")).ageRating).toBe("PEGI 12");
    igdb.mockResolvedValue([{ ...ps, age_ratings: [{ organization: { name: "CERO" }, rating_category: { rating: "CERO_B" } }] }]);
    expect((await fetchGameMeta("Tekken 3")).ageRating).toBe("CERO CERO B");
  });

  it("derives the player count and the website in order of preference", async () => {
    igdb.mockResolvedValue([{ ...ps, multiplayer_modes: [], game_modes: [{ name: "Single player" }] }]);
    expect((await fetchGameMeta("Tekken 3")).players).toBe("1");
    igdb.mockResolvedValue([{ ...ps, multiplayer_modes: [{ onlinemax: 8 }] }]);
    expect((await fetchGameMeta("Tekken 3")).players).toBe("1-8");
    igdb.mockResolvedValue([{ ...ps, websites: [{ url: "https://store.steampowered.com/x", type: { type: "Steam" } }, { url: "https://wiki", type: { type: "Wikipedia" } }] }]);
    expect((await fetchGameMeta("Tekken 3")).url).toBe("https://wiki");
  });

  it("only returns what the service had", async () => {
    igdb.mockResolvedValue([{ id: 3, name: "Bare" }]);
    expect(await fetchGameMeta("Bare")).toEqual({});
  });

  it("throws when nothing matches", async () => {
    igdb.mockResolvedValue([]);
    await expect(fetchGameMeta("Nothing")).rejects.toThrow(/Nothing/);
  });
});

const movie = {
  title: "Matrix",
  original_title: "The Matrix",
  release_date: "1999-03-31",
  genres: [{ name: "Action" }, { name: "Science Fiction" }],
  runtime: 136,
  vote_average: 8.2,
  vote_count: 25000,
  overview: "Neo …",
  tagline: "Welcome to the Real World.",
  homepage: "",
  imdb_id: "tt0133093",
  belongs_to_collection: { name: "The Matrix Collection" },
  production_companies: [{ name: "Village Roadshow Pictures" }],
  production_countries: [{ iso_3166_1: "US", name: "United States of America" }],
  credits: {
    crew: [{ job: "Director", name: "Lana Wachowski" }, { job: "Director", name: "Lilly Wachowski" }],
    cast: [
      { name: "Keanu Reeves", order: 0 },
      { name: "Laurence Fishburne", order: 1 },
      { name: "Carrie-Anne Moss", order: 2 },
      { name: "Hugo Weaving", order: 3 },
      { name: "Joe Pantoliano", order: 5 },
      { name: "Gloria Foster", order: 4 },
    ],
  },
  keywords: { keywords: [{ name: "artificial intelligence" }, { name: "dystopia" }] },
  release_dates: {
    results: [
      { iso_3166_1: "US", release_dates: [{ certification: "R", type: 3 }] },
      { iso_3166_1: "DE", release_dates: [{ certification: "", type: 1 }, { certification: "16", type: 3 }] },
    ],
  },
};

describe("fetchMovieMeta (TMDB)", () => {
  it("maps the movie, its credits, certification and collection", async () => {
    tmdb.mockImplementation(async (path: string) =>
      path.startsWith("/search") ? { results: [{ id: 11, title: "Matrix", original_title: "The Matrix" }] } : movie,
    );
    const out = await fetchMovieMeta("Matrix");
    expect(tmdb.mock.calls[1][0]).toMatch(/^\/movie\/11\?append_to_response=credits,keywords,release_dates/);
    expect(out).toMatchObject({
      releasedate: "19990331T000000",
      genre: "Action, Science Fiction",
      runtime: "136 min",
      rating: "0.820",
      director: "Lana Wachowski, Lilly Wachowski",
      studio: "Village Roadshow Pictures",
      ratingCount: "25000",
      tagline: "Welcome to the Real World.",
      series: "The Matrix Collection",
      ageRating: "R", // English UI → US certification first
      url: "https://www.imdb.com/title/tt0133093/",
      altTitle: "The Matrix",
      cast: "Keanu Reeves, Laurence Fishburne, Carrie-Anne Moss, Hugo Weaving, Gloria Foster",
      country: "United States of America",
      themes: "artificial intelligence, dystopia",
    });
  });

  it("uses the German certification for a German UI and the homepage when set", async () => {
    localStorage.setItem("stickerstudio:lang", "de");
    const { setLang } = await import("./i18n");
    setLang("de");
    tmdb.mockImplementation(async (path: string) =>
      path.startsWith("/search") ? { results: [{ id: 11, title: "Matrix" }] } : { ...movie, homepage: "https://matrix.example" },
    );
    const out = await fetchMovieMeta("Matrix");
    expect(out.ageRating).toBe("16");
    expect(out.url).toBe("https://matrix.example");
    setLang("en");
  });

  it("throws when the search is empty", async () => {
    tmdb.mockResolvedValue({ results: [] });
    await expect(fetchMovieMeta("Nothing")).rejects.toThrow();
  });
});
