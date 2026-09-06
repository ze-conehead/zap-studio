// Cover art lookup. Three sources, chosen in the search dialog:
//  - SteamGridDB  – needs an API key; every platform, high-res box art.
//  - IGDB         – needs a Twitch client id + secret; official cover +
//                   artworks per game.
//  - libretro-thumbnails – no key, retro / emulated systems only. Fallback
//                   when the chosen source has no credentials.
//
// SteamGridDB's API and CDN block browser CORS, and IGDB's API needs an
// OAuth token from Twitch (also CORS-blocked). Vite's dev/preview server
// forwards them for us (see the cover-art proxy in vite.config.ts), so an
// API key only ever goes browser → local Vite → upstream. IGDB's image CDN
// and libretro-thumbnails (GitHub) already send CORS headers.

import { t } from "./i18n";
export interface CoverCandidate {
  title: string;
  region: string; // libretro region tag / SGDB "WxH · style" / IGDB kind
  url: string; // full-resolution, CORS-fetchable
  thumb?: string; // smaller preview, CORS-fetchable
}

export type CoverSource = "sgdb" | "igdb" | "libretro";

// Same-origin paths handled by the Vite cover-art proxy (vite.config.ts).
const SGDB_API = "/api/sgdb";
const IGDB_API = "/api/igdb";
const TWITCH_API = "/api/twitch";
const proxied = (url: string) =>
  `${window.location.origin}/img?url=${encodeURIComponent(url)}`;

// ── stored settings ────────────────────────────────────────────────────────

const SGDB_KEY = "stickerstudio:sgdbKey";
const IGDB_ID = "stickerstudio:igdbClientId";
const IGDB_SECRET = "stickerstudio:igdbClientSecret";
const IGDB_TOKEN = "stickerstudio:igdbToken";
const SOURCE_KEY = "stickerstudio:coverSource";

const ls = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)?.trim() || "";
    } catch {
      return "";
    }
  },
  set: (k: string, v: string) => {
    try {
      if (v.trim()) localStorage.setItem(k, v.trim());
      else localStorage.removeItem(k);
    } catch {
      /* unavailable */
    }
  },
};

export const getSgdbKey = () => ls.get(SGDB_KEY);
export const setSgdbKey = (v: string) => ls.set(SGDB_KEY, v);

export const getIgdbCreds = () => ({
  clientId: ls.get(IGDB_ID),
  clientSecret: ls.get(IGDB_SECRET),
});
export function setIgdbCreds(clientId: string, clientSecret: string) {
  ls.set(IGDB_ID, clientId);
  ls.set(IGDB_SECRET, clientSecret);
  ls.set(IGDB_TOKEN, ""); // force a fresh token
}

export function isConfigured(s: CoverSource): boolean {
  if (s === "sgdb") return !!getSgdbKey();
  if (s === "igdb") {
    const c = getIgdbCreds();
    return !!c.clientId && !!c.clientSecret;
  }
  return true;
}

export function getCoverSource(): CoverSource {
  const v = ls.get(SOURCE_KEY);
  return v === "igdb" || v === "libretro" ? v : "sgdb";
}
export const setCoverSource = (s: CoverSource) => ls.set(SOURCE_KEY, s);

// What actually gets queried: the chosen source if it has credentials,
// otherwise the keyless libretro fallback.
export function effectiveSource(): CoverSource {
  const chosen = getCoverSource();
  return isConfigured(chosen) ? chosen : "libretro";
}

// ── SteamGridDB ────────────────────────────────────────────────────────────

interface SgdbGame {
  id: number;
  name: string;
}
interface SgdbGrid {
  url: string;
  thumb?: string;
  width: number;
  height: number;
  style?: string;
}

async function sgdbFetch<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${SGDB_API}${path}`, {
      headers: { Authorization: `Bearer ${getSgdbKey()}` },
    });
  } catch {
    throw new Error(t("SteamGridDB is not reachable."));
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      t("SteamGridDB API key missing or invalid. Create a new key at steamgriddb.com."),
    );
  }
  if (!res.ok) throw new Error(t("SteamGridDB error (HTTP {status}).", { status: res.status }));
  return res.json() as Promise<T>;
}

async function searchCoversSGDB(gameTitle: string): Promise<CoverCandidate[]> {
  const found = await sgdbFetch<{ data?: SgdbGame[] }>(
    `/search/autocomplete/${encodeURIComponent(gameTitle)}`,
  );
  const games = found.data ?? [];
  if (!games.length) return [];

  const q = normalizeTitle(gameTitle);
  const game = games.find((g) => normalizeTitle(g.name) === q) ?? games[0];

  const base = `/grids/game/${game.id}?types=static&nsfw=false&humor=false`;
  let grids =
    (await sgdbFetch<{ data?: SgdbGrid[] }>(`${base}&dimensions=600x900,660x930,342x482`))
      .data ?? [];
  if (!grids.length) {
    grids = (await sgdbFetch<{ data?: SgdbGrid[] }>(base)).data ?? [];
  }

  return grids.slice(0, 24).map((g) => ({
    title: game.name,
    region: `${g.width}×${g.height}${g.style ? ` · ${g.style}` : ""}`,
    url: proxied(g.url),
    thumb: g.thumb ? proxied(g.thumb) : undefined,
  }));
}

// ── IGDB ───────────────────────────────────────────────────────────────────

async function igdbToken(): Promise<string> {
  try {
    const cached = JSON.parse(ls.get(IGDB_TOKEN) || "null") as {
      token: string;
      expiresAt: number;
    } | null;
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  } catch {
    /* refetch */
  }

  const { clientId, clientSecret } = getIgdbCreds();
  let res: Response;
  try {
    res = await fetch(
      `${TWITCH_API}/oauth2/token?client_id=${encodeURIComponent(
        clientId,
      )}&client_secret=${encodeURIComponent(clientSecret)}&grant_type=client_credentials`,
      { method: "POST" },
    );
  } catch {
    throw new Error(t("IGDB/Twitch is not reachable."));
  }
  if (!res.ok) {
    throw new Error(
      t("IGDB credentials invalid. Create a Client ID and Client Secret at dev.twitch.tv."),
    );
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  ls.set(
    IGDB_TOKEN,
    JSON.stringify({
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    }),
  );
  return data.access_token;
}

interface IgdbGame {
  name: string;
  cover?: { image_id: string };
  artworks?: { image_id: string }[];
}

async function igdbQuery(body: string): Promise<IgdbGame[]> {
  const token = await igdbToken();
  const { clientId } = getIgdbCreds();
  let res: Response;
  try {
    res = await fetch(`${IGDB_API}/games`, {
      method: "POST",
      headers: { "Client-ID": clientId, Authorization: `Bearer ${token}` },
      body,
    });
  } catch {
    throw new Error(t("IGDB is not reachable."));
  }
  if (res.status === 401) {
    ls.set(IGDB_TOKEN, "");
    throw new Error(t("IGDB token expired – please search again."));
  }
  if (!res.ok) throw new Error(t("IGDB error (HTTP {status}).", { status: res.status }));
  return res.json() as Promise<IgdbGame[]>;
}

const igdbImg = (id: string, size: string) =>
  `https://images.igdb.com/igdb/image/upload/t_${size}/${id}.jpg`;

async function searchCoversIGDB(gameTitle: string): Promise<CoverCandidate[]> {
  const escaped = gameTitle.replace(/"/g, '\\"');
  const games = await igdbQuery(
    `search "${escaped}"; fields name, cover.image_id, artworks.image_id; limit 8;`,
  );
  if (!games.length) return [];

  const q = normalizeTitle(gameTitle);
  const game = games.find((g) => normalizeTitle(g.name) === q) ?? games[0];

  const out: CoverCandidate[] = [];
  if (game.cover?.image_id) {
    out.push({
      title: game.name,
      region: "Cover",
      url: igdbImg(game.cover.image_id, "1080p"),
      thumb: igdbImg(game.cover.image_id, "cover_big"),
    });
  }
  for (const a of game.artworks ?? []) {
    if (!a.image_id) continue;
    out.push({
      title: game.name,
      region: "Artwork",
      url: igdbImg(a.image_id, "1080p"),
      thumb: igdbImg(a.image_id, "screenshot_med"),
    });
  }
  return out;
}

// ── libretro-thumbnails ────────────────────────────────────────────────────

// Console name (normalized, lowercase) -> libretro-thumbnails repo slug.
const REPO_BY_CONSOLE: Record<string, string> = {
  "nintendo 64": "Nintendo_-_Nintendo_64",
  n64: "Nintendo_-_Nintendo_64",
  "sega mega drive": "Sega_-_Mega_Drive_-_Genesis",
  "mega drive": "Sega_-_Mega_Drive_-_Genesis",
  "sega genesis": "Sega_-_Mega_Drive_-_Genesis",
  genesis: "Sega_-_Mega_Drive_-_Genesis",
  "super nintendo": "Nintendo_-_Super_Nintendo_Entertainment_System",
  "super nintendo entertainment system": "Nintendo_-_Super_Nintendo_Entertainment_System",
  snes: "Nintendo_-_Super_Nintendo_Entertainment_System",
  "super famicom": "Nintendo_-_Super_Nintendo_Entertainment_System",
  "nintendo entertainment system": "Nintendo_-_Nintendo_Entertainment_System",
  nes: "Nintendo_-_Nintendo_Entertainment_System",
  famicom: "Nintendo_-_Nintendo_Entertainment_System",
  "game boy": "Nintendo_-_Game_Boy",
  "game boy color": "Nintendo_-_Game_Boy_Color",
  gbc: "Nintendo_-_Game_Boy_Color",
  "game boy advance": "Nintendo_-_Game_Boy_Advance",
  gba: "Nintendo_-_Game_Boy_Advance",
  gamecube: "Nintendo_-_GameCube",
  "nintendo gamecube": "Nintendo_-_GameCube",
  gcn: "Nintendo_-_GameCube",
  wii: "Nintendo_-_Wii",
  "wii u": "Nintendo_-_Wii_U",
  "nintendo ds": "Nintendo_-_Nintendo_DS",
  "nintendo 3ds": "Nintendo_-_Nintendo_3DS",
  playstation: "Sony_-_PlayStation",
  "playstation 1": "Sony_-_PlayStation",
  ps1: "Sony_-_PlayStation",
  psx: "Sony_-_PlayStation",
  psone: "Sony_-_PlayStation",
  "playstation 2": "Sony_-_PlayStation_2",
  ps2: "Sony_-_PlayStation_2",
  "playstation 3": "Sony_-_PlayStation_3",
  ps3: "Sony_-_PlayStation_3",
  "playstation 4": "Sony_-_PlayStation_4",
  ps4: "Sony_-_PlayStation_4",
  "playstation vita": "Sony_-_PlayStation_Vita",
  "playstation portable": "Sony_-_PlayStation_Portable",
  psp: "Sony_-_PlayStation_Portable",
  xbox: "Microsoft_-_Xbox",
  "xbox 360": "Microsoft_-_Xbox_360",
  "sega saturn": "Sega_-_Saturn",
  saturn: "Sega_-_Saturn",
  dreamcast: "Sega_-_Dreamcast",
  "sega dreamcast": "Sega_-_Dreamcast",
  "sega game gear": "Sega_-_Game_Gear",
  "game gear": "Sega_-_Game_Gear",
  "sega master system": "Sega_-_Master_System_-_Mark_III",
  "master system": "Sega_-_Master_System_-_Mark_III",
  "atari 2600": "Atari_-_2600",
  "neo geo": "SNK_-_Neo_Geo",
  neogeo: "SNK_-_Neo_Geo",
};

function normalizeConsoleName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function resolveLibretroRepo(consoleName: string): string | undefined {
  return REPO_BY_CONSOLE[normalizeConsoleName(consoleName)];
}

interface TreeEntry {
  path: string;
  sha: string;
  type: string;
}

const treeCache = new Map<string, Promise<TreeEntry[]>>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// GitHub's recursive-tree endpoint 500s intermittently on big repos, so
// retry a few times before giving up — and never keep a rejected promise in
// the cache (that would make a manual retry fail forever).
async function fetchTree(repo: string): Promise<TreeEntry[]> {
  const url = `https://api.github.com/repos/libretro-thumbnails/${repo}/git/trees/master?recursive=1`;
  let lastErr = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt) await sleep(500 * attempt);
    let res: Response;
    try {
      res = await fetch(url);
    } catch {
      lastErr = t("GitHub not reachable.");
      continue;
    }
    if (res.ok) {
      const d = (await res.json()) as { tree?: TreeEntry[] };
      return (d.tree ?? []).filter((e) => e.type === "blob");
    }
    lastErr = t("GitHub request failed (HTTP {status}).", { status: res.status });
    if (res.status < 500 && res.status !== 429) break; // 4xx won't fix itself
  }
  throw new Error(lastErr);
}

async function loadTree(repo: string): Promise<TreeEntry[]> {
  let pending = treeCache.get(repo);
  if (!pending) {
    pending = fetchTree(repo);
    treeCache.set(repo, pending);
    pending.catch(() => treeCache.delete(repo));
  }
  return pending;
}

const COMBINING = new RegExp("[\\u0300-\\u036f]", "g");

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// "Super Mario 64 (USA).png" -> { core: "Super Mario 64", region: "(USA)" }
function splitBoxartName(filename: string): { core: string; region: string } {
  const name = filename.replace(/\.[a-z0-9]+$/i, "");
  const firstParen = name.indexOf(" (");
  if (firstParen === -1) return { core: name, region: "" };
  return { core: name.slice(0, firstParen), region: name.slice(firstParen).trim() };
}

async function searchCoversLibretro(
  consoleName: string,
  gameTitle: string,
): Promise<CoverCandidate[]> {
  const repo = resolveLibretroRepo(consoleName);
  if (!repo) return [];

  const tree = await loadTree(repo);
  const query = normalizeTitle(gameTitle);
  if (!query) return [];

  const seenSha = new Set<string>();
  const matches: { path: string; core: string; region: string; exact: boolean }[] = [];
  for (const entry of tree) {
    if (!entry.path.startsWith("Named_Boxarts/")) continue;
    const filename = entry.path.slice("Named_Boxarts/".length);
    const { core, region } = splitBoxartName(filename);
    const normCore = normalizeTitle(core);
    const isMatch = normCore === query || normCore.includes(query) || query.includes(normCore);
    if (!isMatch || seenSha.has(entry.sha)) continue;
    seenSha.add(entry.sha);
    matches.push({ path: entry.path, core, region, exact: normCore === query });
  }

  matches.sort((a, b) => {
    if (a.exact !== b.exact) return a.exact ? -1 : 1;
    const aRough = /beta|proto|demo/i.test(a.region);
    const bRough = /beta|proto|demo/i.test(b.region);
    if (aRough !== bRough) return aRough ? 1 : -1;
    return a.core.length - b.core.length;
  });

  return matches.slice(0, 16).map((m) => ({
    title: m.core,
    region: m.region,
    url: `https://raw.githubusercontent.com/libretro-thumbnails/${repo}/master/${m.path
      .split("/")
      .map(encodeURIComponent)
      .join("/")}`,
  }));
}

// ── Public entry point ─────────────────────────────────────────────────────

export async function searchCovers(
  consoleName: string,
  gameTitle: string,
): Promise<CoverCandidate[]> {
  const title = gameTitle.trim();
  if (!title) return [];
  const src = effectiveSource();
  if (src === "sgdb") return searchCoversSGDB(title);
  if (src === "igdb") return searchCoversIGDB(title);
  return searchCoversLibretro(consoleName, title);
}
