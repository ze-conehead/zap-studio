// Maps a catalogue gameKey ("console-id/game-id") to the project id that
// holds its sticker, so picking a game in the tree reopens the same design.

const KEY = "stickerstudio:gameIndex";

type Index = Record<string, string>;

function read(): Index {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}") as Index;
  } catch {
    return {};
  }
}

export function getGameProject(gameKey: string): string | undefined {
  return read()[gameKey];
}

export function linkGameProject(gameKey: string, projectId: string): void {
  const idx = read();
  idx[gameKey] = projectId;
  localStorage.setItem(KEY, JSON.stringify(idx));
}

export function unlinkProject(projectId: string): void {
  const idx = read();
  let changed = false;
  for (const [k, v] of Object.entries(idx)) {
    if (v === projectId) {
      delete idx[k];
      changed = true;
    }
  }
  if (changed) localStorage.setItem(KEY, JSON.stringify(idx));
}
