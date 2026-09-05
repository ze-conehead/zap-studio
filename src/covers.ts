// Cover art lookup. Two sources:
//  - SteamGridDB (when an API key is configured): every platform, high-res
//    box art. Its API and CDN both block browser CORS and the API needs a
//    Bearer key, so requests go through the public CORS proxy proxy.cors.sh
//    (free for localhost) and images through the wsrv.nl image proxy.
//  - libretro-thumbnails (no key): static box-art scans on GitHub, retro /
//    emulated systems only. Used as the fallback when there's no key.

export interface CoverCandidate {
  title: string;
  region: string; // libretro region tag, or SGDB "WxH · style"
  url: string; // full-resolution, CORS-fetchable
  thumb?: string; // smaller preview, CORS-fetchable
}

// ── SteamGridDB ─────────────────────────────────────────────────────────────

const SGDB_KEY_STORAGE = "stickerstudio:sgdbKey";
const CORS_PROXY = "https://proxy.cors.sh/";
const IMG_PROXY = "https://wsrv.nl/?url=";

export function getSgdbKey(): string {
  try {
    return localStorage.getItem(SGDB_KEY_STORAGE)?.trim() || "";
  } catch {
    return "";
  }
}

export function setSgdbKey(key: string): void {
  try {
    const k = key.trim();
    if (k) localStorage.setItem(SGDB_KEY_STORAGE, k);
    else localStorage.removeItem(SGDB_KEY_STORAGE);
  } catch {
    /* storage unavailable */
  }
}

export function usingSGDB(): boolean {
  return !!getSgdbKey();
}

const proxied = (url: string) => IMG_PROXY + encodeURIComponent(url);

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
    res = await fetch(`${CORS_PROXY}https://www.steamgriddb.com/api/v2${path}`, {
      headers: { Authorization: `Bearer ${getSgdbKey()}` },
    });
  } catch {
    throw new Error(
      "SteamGridDB nicht erreichbar – der CORS-Proxy (proxy.cors.sh) antwortet nicht.",
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      "SteamGridDB-API-Key fehlt oder ist ungültig. Neuen Key unter steamgriddb.com anlegen.",
    );
  }
  if (!res.ok) throw new Error(`SteamGridDB-Fehler (HTTP ${res.status}).`);
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

  const q1 = `/grids/game/${game.id}?types=static&nsfw=false&humor=false`;
  let grids =
    (await sgdbFetch<{ data?: SgdbGrid[] }>(`${q1}&dimensions=600x900,660x930,342x482`))
      .data ?? [];
  if (!grids.length) {
    grids = (await sgdbFetch<{ data?: SgdbGrid[] }>(q1)).data ?? [];
  }

  return grids.slice(0, 24).map((g) => ({
    title: game.name,
    region: `${g.width}×${g.height}${g.style ? ` · ${g.style}` : ""}`,
    url: proxied(g.url),
    thumb: g.thumb ? proxied(g.thumb) : undefined,
  }));
}

// ── libretro-thumbnails ─────────────────────────────────────────────────────

// Console name (normalized, lowercase) -> libretro-thumbnails repo slug.
// https://github.com/libretro-thumbnails
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

async function loadTree(repo: string): Promise<TreeEntry[]> {
  let pending = treeCache.get(repo);
  if (!pending) {
    pending = fetch(
      `https://api.github.com/repos/libretro-thumbnails/${repo}/git/trees/master?recursive=1`,
    )
      .then((r) => {
        if (!r.ok) throw new Error(`GitHub-Anfrage fehlgeschlagen (HTTP ${r.status}).`);
        return r.json() as Promise<{ tree?: TreeEntry[] }>;
      })
      .then((d) => (d.tree ?? []).filter((e) => e.type === "blob"));
    treeCache.set(repo, pending);
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

// SteamGridDB when an API key is set (every console, high-res), otherwise
// libretro-thumbnails (retro consoles, no key).
export async function searchCovers(
  consoleName: string,
  gameTitle: string,
): Promise<CoverCandidate[]> {
  const title = gameTitle.trim();
  if (!title) return [];
  if (usingSGDB()) return searchCoversSGDB(title);
  return searchCoversLibretro(consoleName, title);
}
