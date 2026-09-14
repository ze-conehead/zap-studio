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

// Exact normalized title match first, else the first hit.
const pick = <T>(hits: T[], title: string, name: (h: T) => string | undefined) => {
  const q = normalizeTitle(title);
  return hits.find((h) => normalizeTitle(name(h) ?? "") === q) ?? hits[0];
};

// ── TMDB (movies) ───────────────────────────────────────────────────────────

interface TmdbHit {
  id: number;
  title?: string;
  original_title?: string;
}
interface TmdbMovie {
  release_date?: string;
  genres?: { name: string }[];
  runtime?: number;
  vote_average?: number;
  overview?: string;
  production_companies?: { name: string }[];
  credits?: { crew?: { job?: string; name?: string }[] };
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
    `/movie/${hit.id}?append_to_response=credits&language=${lang}`,
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
  summary?: string;
}

export async function fetchGameMeta(title: string): Promise<MetaPatch> {
  if (!isConfigured("igdb")) {
    throw new Error(t("No IGDB credentials yet — Settings ▸ API keys …"));
  }
  const escaped = title.trim().replace(/"/g, '\\"');
  const hits = await igdbFetch<IgdbGameFull[]>(
    "games",
    `search "${escaped}"; fields name, first_release_date, genres.name, ` +
      `involved_companies.developer, involved_companies.publisher, ` +
      `involved_companies.company.name, rating, aggregated_rating, summary; limit 10;`,
  );
  if (!hits.length) throw new Error(t("Nothing found for “{title}”.", { title }));
  const g = pick(hits, title, (h) => h.name);

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
  if (g.summary) out.desc = g.summary;
  return out;
}
