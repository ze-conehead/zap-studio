// Fills a card's metadata (the gamelist.xml-shaped GameMeta) from the same
// services the cover search already has keys for: TMDB for movies, IGDB for
// games. Only fields the service actually returned come back, so a fetch
// never blanks something the user typed by hand.

import { igdbFetch, isConfigured, normalizeTitle, tmdbFetch } from "./covers";
import type { GameMeta } from "./gamelist";
import { getLang, t } from "./i18n";

export type MetaPatch = Partial<Omit<GameMeta, "name">>;

// "2008-05-02" / a Date → the gamelist "YYYYMMDDT000000" form.
const stamp = (y: number, m: number, d: number) =>
  `${y}${String(m).padStart(2, "0")}${String(d).padStart(2, "0")}T000000`;

const fromIso = (iso: string | undefined) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? stamp(+m[1], +m[2], +m[3]) : undefined;
};

const fromUnix = (s: number | undefined) => {
  if (!s) return undefined;
  const d = new Date(s * 1000);
  return stamp(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
};

// Exact normalized title match first, else the first hit. `prefer` breaks
// ties among exact matches (the hit released on the card's console, say).
const pick = <T>(
  hits: T[],
  title: string,
  name: (h: T) => string | undefined,
  prefer?: (h: T) => boolean,
) => {
  const q = normalizeTitle(title);
  const exact = hits.filter((h) => normalizeTitle(name(h) ?? "") === q);
  return (prefer && exact.find(prefer)) ?? exact[0] ?? hits[0];
};

const names = (xs: { name?: string }[] | undefined) =>
  (xs ?? []).map((x) => x.name).filter((n): n is string => !!n);

const joined = (xs: { name?: string }[] | undefined) => {
  const n = names(xs);
  return n.length ? n.join(", ") : undefined;
};

// ── TMDB (movies) ───────────────────────────────────────────────────────────

interface TmdbHit {
  id: number;
  title?: string;
  original_title?: string;
}
interface TmdbMovie {
  title?: string;
  original_title?: string;
  release_date?: string;
  genres?: { name: string }[];
  runtime?: number;
  vote_average?: number;
  vote_count?: number;
  overview?: string;
  tagline?: string;
  homepage?: string;
  imdb_id?: string;
  belongs_to_collection?: { name?: string } | null;
  production_companies?: { name: string }[];
  production_countries?: { iso_3166_1?: string; name?: string }[];
  credits?: {
    crew?: { job?: string; name?: string }[];
    cast?: { name?: string; order?: number }[];
  };
  keywords?: { keywords?: { name?: string }[] };
  release_dates?: {
    results?: {
      iso_3166_1?: string;
      release_dates?: { certification?: string; type?: number }[];
    }[];
  };
}

// The age certification for a country: the first non-empty one among its
// theatrical / digital / physical releases.
function certification(m: TmdbMovie, country: string): string | undefined {
  const entry = m.release_dates?.results?.find((r) => r.iso_3166_1 === country);
  return entry?.release_dates?.map((d) => d.certification?.trim()).find((c) => !!c);
}

export async function fetchMovieMeta(title: string): Promise<MetaPatch> {
  if (!isConfigured("tmdb")) {
    throw new Error(t("No TMDB API key yet — Settings ▸ API keys …"));
  }
  const lang = getLang() === "de" ? "de-DE" : "en-US";
  const q = encodeURIComponent(title.trim());
  const found = await tmdbFetch<{ results?: TmdbHit[] }>(
    `/search/movie?query=${q}&include_adult=false&language=${lang}`,
  );
  const hits = found.results ?? [];
  if (!hits.length) throw new Error(t("Nothing found for “{title}”.", { title }));
  const hit = pick(hits, title, (h) => h.title) ?? pick(hits, title, (h) => h.original_title);

  const m = await tmdbFetch<TmdbMovie>(
    `/movie/${hit.id}?append_to_response=credits,keywords,release_dates&language=${lang}`,
  );
  const directors = (m.credits?.crew ?? [])
    .filter((c) => c.job === "Director" && c.name)
    .map((c) => c.name!);

  const out: MetaPatch = {};
  const date = fromIso(m.release_date);
  if (date) out.releasedate = date;
  if (m.genres?.length) out.genre = m.genres.map((g) => g.name).join(", ");
  if (m.runtime) out.runtime = `${m.runtime} min`;
  if (m.vote_average) out.rating = (m.vote_average / 10).toFixed(3);
  if (directors.length) out.director = directors.join(", ");
  if (m.production_companies?.[0]?.name) out.studio = m.production_companies[0].name;
  if (m.overview) out.desc = m.overview;
  if (m.vote_count) out.ratingCount = String(m.vote_count);
  if (m.tagline) out.tagline = m.tagline;
  if (m.belongs_to_collection?.name) out.series = m.belongs_to_collection.name;
  const cert = getLang() === "de"
    ? certification(m, "DE") ?? certification(m, "US")
    : certification(m, "US") ?? certification(m, "GB") ?? certification(m, "DE");
  if (cert) out.ageRating = cert;
  const url = m.homepage || (m.imdb_id ? `https://www.imdb.com/title/${m.imdb_id}/` : "");
  if (url) out.url = url;
  if (m.original_title && m.original_title !== (m.title ?? title)) {
    out.altTitle = m.original_title;
  }
  const cast = [...(m.credits?.cast ?? [])]
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99))
    .slice(0, 5);
  if (cast.length) out.cast = joined(cast);
  const countries = joined(m.production_countries);
  if (countries) out.country = countries;
  const keywords = names(m.keywords?.keywords).slice(0, 8);
  if (keywords.length) out.themes = keywords.join(", ");
  return out;
}

// ── IGDB (games) ────────────────────────────────────────────────────────────

interface IgdbGameFull {
  id: number;
  name?: string;
  first_release_date?: number;
  genres?: { name: string }[];
  involved_companies?: {
    developer?: boolean;
    publisher?: boolean;
    company?: { name?: string };
  }[];
  rating?: number; // users, 0..100
  aggregated_rating?: number; // critics, 0..100
  rating_count?: number;
  aggregated_rating_count?: number;
  summary?: string;
  storyline?: string;
  platforms?: { name?: string; abbreviation?: string }[];
  franchises?: { name?: string }[];
  collections?: { name?: string }[];
  themes?: { name?: string }[];
  game_modes?: { name?: string }[];
  player_perspectives?: { name?: string }[];
  game_engines?: { name?: string }[];
  alternative_names?: { name?: string }[];
  websites?: { url?: string; type?: { type?: string } }[];
  age_ratings?: {
    organization?: { name?: string };
    rating_category?: { rating?: string };
  }[];
  multiplayer_modes?: {
    offlinemax?: number;
    offlinecoopmax?: number;
    onlinemax?: number;
    splitscreen?: boolean;
  }[];
}

const IGDB_FIELDS =
  "name, first_release_date, genres.name, " +
  "involved_companies.developer, involved_companies.publisher, involved_companies.company.name, " +
  "rating, aggregated_rating, rating_count, aggregated_rating_count, summary, storyline, " +
  "platforms.name, platforms.abbreviation, franchises.name, collections.name, themes.name, " +
  "game_modes.name, player_perspectives.name, game_engines.name, alternative_names.name, " +
  "websites.url, websites.type.type, " +
  "age_ratings.organization.name, age_ratings.rating_category.rating, " +
  "multiplayer_modes.offlinemax, multiplayer_modes.offlinecoopmax, multiplayer_modes.onlinemax, " +
  "multiplayer_modes.splitscreen";

// IGDB spells some ratings out ("Twelve"); cards want "PEGI 12".
const RATING_WORDS: Record<string, string> = {
  three: "3",
  seven: "7",
  twelve: "12",
  sixteen: "16",
  eighteen: "18",
  zero: "0",
  six: "6",
  ten: "10",
  fourteen: "14",
  fifteen: "15",
};

// One age rating per game: the German user's USK first, then PEGI, then
// ESRB, then whatever else the entry has.
function ageRating(g: IgdbGameFull): string | undefined {
  const order = ["USK", "PEGI", "ESRB"];
  const rated = (g.age_ratings ?? [])
    .map((r) => ({ org: r.organization?.name?.trim() ?? "", rating: r.rating_category?.rating?.trim() ?? "" }))
    .filter((r) => r.org && r.rating);
  if (!rated.length) return undefined;
  rated.sort((a, b) => {
    const ia = order.indexOf(a.org), ib = order.indexOf(b.org);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
  const r = rated[0];
  const word = RATING_WORDS[r.rating.toLowerCase()];
  return `${r.org} ${word ?? r.rating.replace(/_/g, " ")}`;
}

// "1", "1-2", "1-4": the most that can play together offline, or online
// when it's online-only.
function players(g: IgdbGameFull): string | undefined {
  const modes = g.multiplayer_modes ?? [];
  const offline = Math.max(0, ...modes.map((m) => Math.max(m.offlinemax ?? 0, m.offlinecoopmax ?? 0)));
  const online = Math.max(0, ...modes.map((m) => m.onlinemax ?? 0));
  const max = offline || online;
  if (max > 1) return `1-${max}`;
  const modeNames = names(g.game_modes).map((n) => n.toLowerCase());
  if (modeNames.length && modeNames.every((n) => n === "single player")) return "1";
  return max === 1 ? "1" : undefined;
}

function website(g: IgdbGameFull): string | undefined {
  const sites = (g.websites ?? []).filter((w) => w.url);
  const by = (kind: string) =>
    sites.find((w) => (w.type?.type ?? "").toLowerCase() === kind)?.url;
  return by("official") ?? by("wikipedia") ?? by("steam") ?? by("wikia") ?? sites[0]?.url;
}

export async function fetchGameMeta(title: string, consoleName?: string): Promise<MetaPatch> {
  if (!isConfigured("igdb")) {
    throw new Error(t("No IGDB credentials yet — Settings ▸ API keys …"));
  }
  const escaped = title.trim().replace(/"/g, '\\"');
  const hits = await igdbFetch<IgdbGameFull[]>(
    "games",
    `search "${escaped}"; fields ${IGDB_FIELDS}; limit 10;`,
  );
  if (!hits.length) throw new Error(t("Nothing found for “{title}”.", { title }));
  // Among exact title matches, prefer the one released on this console —
  // "Tekken 3" the PlayStation game over the arcade board.
  const wanted = normalizeTitle(consoleName ?? "");
  const onConsole = (h: IgdbGameFull) =>
    !!wanted &&
    (h.platforms ?? []).some((p) => {
      const n = normalizeTitle(p.name ?? "");
      const a = normalizeTitle(p.abbreviation ?? "");
      return !!n && (n === wanted || n.includes(wanted) || wanted.includes(n) || (!!a && a === wanted));
    });
  const g = pick(hits, title, (h) => h.name, onConsole);

  const companies = (role: "developer" | "publisher") =>
    (g.involved_companies ?? [])
      .filter((c) => c[role] && c.company?.name)
      .map((c) => c.company!.name!);

  const out: MetaPatch = {};
  const date = fromUnix(g.first_release_date);
  if (date) out.releasedate = date;
  if (g.genres?.length) out.genre = g.genres.map((x) => x.name).join(", ");
  const dev = companies("developer");
  const pub = companies("publisher");
  if (dev.length) out.developer = dev.join(", ");
  if (pub.length) out.publisher = pub.join(", ");
  const score = g.aggregated_rating || g.rating;
  if (score) out.rating = (score / 100).toFixed(3);
  const votes = g.aggregated_rating ? g.aggregated_rating_count : g.rating_count;
  if (votes) out.ratingCount = String(votes);
  if (g.summary) out.desc = g.summary;
  if (g.storyline) out.storyline = g.storyline;
  const p = players(g);
  if (p) out.players = p;
  const age = ageRating(g);
  if (age) out.ageRating = age;
  const series = joined(g.franchises) ?? joined(g.collections);
  if (series) out.series = series;
  const url = website(g);
  if (url) out.url = url;
  const alt = names(g.alternative_names).find((n) => normalizeTitle(n) !== normalizeTitle(title));
  if (alt) out.altTitle = alt;
  const themes = joined(g.themes);
  if (themes) out.themes = themes;
  const modes = joined(g.game_modes);
  if (modes) out.modes = modes;
  const perspective = joined(g.player_perspectives);
  if (perspective) out.perspective = perspective;
  const engine = joined(g.game_engines);
  if (engine) out.engine = engine;
  return out;
}
