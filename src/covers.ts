// Cover art lookup backed by the community-maintained "libretro-thumbnails"
// GitHub org — real box-art scans, no API key, no server of our own needed.
// Coverage is limited to systems RetroArch can emulate, so current-gen
// consoles (Switch, PS5, Xbox Series) have no repo and return no results.

export interface CoverCandidate {
  title: string; // filename core, without region/version tags
  region: string; // e.g. "(USA)", "(Europe) (En,Fr,De)" — may be empty
  url: string; // full-resolution raw.githubusercontent.com URL
}

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

// Searches the console's libretro-thumbnails box-art folder for filenames
// matching `gameTitle`. Returns [] if the console has no known repo, or
// nothing matched. Exact-title hits and non-beta/proto scans sort first.
export async function searchCovers(
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
