// "A newer version is available" for the desktop app. The packaged builds
// can't self-update — macOS only allows that for signed apps, and the
// Windows build is a portable .exe with nothing to update in place — so
// this just asks GitHub for the latest release once per session and lets
// the menu bar show a link. The browser build is served from source and
// never needs it.

import { isDesktop } from "./desktop";

const RELEASES_API = "https://api.github.com/repos/ze-conehead/zap-studio/releases/latest";
const DISMISSED_KEY = "stickerstudio:updateDismissed";

export interface UpdateInfo {
  version: string; // "1.2.0"
  url: string; // release page
}

/** Injected by vite.config.ts from package.json. */
export const APP_VERSION: string = __APP_VERSION__;

const num = (s: string) => s.replace(/^v/i, "").split(".").map((p) => parseInt(p, 10) || 0);

/** > 0 if `a` is newer than `b`, < 0 if older, 0 if equal. */
export function compareVersions(a: string, b: string): number {
  const x = num(a);
  const y = num(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d) return d;
  }
  return 0;
}

export function dismissUpdate(version: string): void {
  try {
    localStorage.setItem(DISMISSED_KEY, version);
  } catch {
    /* storage unavailable */
  }
}

function dismissed(): string {
  try {
    return localStorage.getItem(DISMISSED_KEY) ?? "";
  } catch {
    return "";
  }
}

// One fetch per session, however many times the menu bar mounts (it
// remounts on every project switch).
let inflight: Promise<UpdateInfo | null> | null = null;

/**
 * The newer release to point at, or null: not the desktop app, offline,
 * already on the latest, or this version was dismissed.
 */
export function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isDesktop()) return Promise.resolve(null);
  if (!inflight) {
    inflight = (async () => {
      try {
        const res = await fetch(RELEASES_API, {
          headers: { Accept: "application/vnd.github+json" },
        });
        if (!res.ok) return null;
        const data = (await res.json()) as { tag_name?: string; html_url?: string };
        if (!data.tag_name || !data.html_url) return null;
        const version = data.tag_name.replace(/^v/i, "");
        if (compareVersions(version, APP_VERSION) <= 0) return null;
        if (dismissed() === version) return null;
        return { version, url: data.html_url };
      } catch {
        return null; // offline — say nothing
      }
    })();
  }
  return inflight;
}
