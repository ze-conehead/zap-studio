// Import games from a Zaparoo Core service — e.g. running on a MiSTer FPGA.
// JSON-RPC 2.0 over HTTP POST to <ip>:7497/api/v0.1.
//   https://zaparoo.org/docs/core/api/
//
// Zaparoo only sends CORS headers to a fixed origin allowlist, so the call
// is forwarded through the dev server in the browser (POST /zaparoo?ip=… —
// see the zaparoo-proxy plugin in vite.config.ts) and through the Electron
// main process in the packaged desktop app (src/desktop.ts).

import { isDesktop } from "./desktop";
import type { GameMeta } from "./gamelist";
import { t } from "./i18n";

const IP_KEY = "stickerstudio:zaparooHost";

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

/** Remembered "192.168.x.x" or "192.168.x.x:7497" between sessions. */
export const getZaparooHost = () => ls.get(IP_KEY);
export const setZaparooHost = (v: string) => ls.set(IP_KEY, v);

// Splits "192.168.1.50:7497" into its parts; the port is optional.
function splitHost(raw: string): { ip: string; port?: string } {
  const s = raw.trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const m = /^(\[[^\]]+\]|[^:]+)(?::(\d{1,5}))?$/.exec(s);
  return m ? { ip: m[1], port: m[2] } : { ip: s };
}

async function rpc<T>(host: string, method: string, params?: unknown): Promise<T> {
  const { ip, port } = splitHost(host);
  if (!ip) throw new Error(t("Enter the Zaparoo / MiSTer address first."));
  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: crypto.randomUUID?.() ?? `${Date.now()}`,
    method,
    params,
  });

  let text: string;
  if (isDesktop()) {
    const r = await window.desktop!.zaparooRpc(ip, port ? Number(port) : 7497, body);
    if ("error" in r) {
      if (r.error === "bad-host") {
        throw new Error(
          t("{host} isn't a local address — this only reaches a device on your network.", {
            host,
          }),
        );
      }
      throw new Error(
        t("Can't reach Zaparoo at {host}. Check the address and that Zaparoo Core is running.", {
          host,
        }),
      );
    }
    text = r.text;
  } else {
    const url =
      `/zaparoo?ip=${encodeURIComponent(ip)}` + (port ? `&port=${port}` : "");
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
    } catch {
      throw new Error(t("The dev server isn't reachable — is it running?"));
    }
    if (res.status === 502 || res.status === 504) {
      throw new Error(
        t("Can't reach Zaparoo at {host}. Check the address and that Zaparoo Core is running.", {
          host,
        }),
      );
    }
    if (res.status === 400) {
      throw new Error(
        t("{host} isn't a local address — this only reaches a device on your network.", { host }),
      );
    }
    if (!res.ok) {
      throw new Error(t("Zaparoo error (HTTP {status}).", { status: res.status }));
    }
    text = await res.text();
  }

  const data = JSON.parse(text) as { result?: T; error?: { message?: string } };
  if (data.error) {
    throw new Error(t("Zaparoo: {message}", { message: data.error.message ?? "error" }));
  }
  return data.result as T;
}

export interface ZaparooSystem {
  id: string;
  name: string;
  category?: string;
  manufacturer?: string;
  mediaCount?: number;
}

export interface ZaparooGame {
  systemId: string;
  systemName: string;
  title: string;
  meta: Partial<Omit<GameMeta, "name">>;
}

/** version → also the connection check. */
export async function zaparooVersion(
  host: string,
): Promise<{ platform: string; version: string }> {
  const v = await rpc<{ platform?: string; version?: string }>(host, "version");
  return { platform: v.platform ?? "?", version: v.version ?? "?" };
}

/** Every system that has indexed media, biggest first. */
export async function zaparooSystems(host: string): Promise<ZaparooSystem[]> {
  const r = await rpc<{ systems?: ZaparooSystem[] }>(host, "systems", {});
  return (r.systems ?? [])
    .filter((s) => s.id && (s.mediaCount ?? 1) > 0)
    .sort((a, b) => (b.mediaCount ?? 0) - (a.mediaCount ?? 0));
}

interface ZapMedia {
  name?: string;
  system?: { id?: string; name?: string; category?: string };
  tags?: { tag?: string; type?: string }[];
}

// ROM filenames carry region / revision / language tags in brackets — the
// No-Intro / TOSEC convention — so one game shows up many times. Strip every
// "(…)" and "[…]" group to get the bare title.
//   "Super Mario World (USA) (Rev 1) [!]" → "Super Mario World"
export function cleanRomTitle(name: string): string {
  const clean = name
    .replace(/\s*[([][^()[\]]*[)\]]/g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*[-–,:]\s*$/, "")
    .trim();
  return clean || name.trim();
}

// Zaparoo tags carry the metadata: {type:"year", tag:"1997"} etc.
function tagsToMeta(tags: ZapMedia["tags"]): Partial<Omit<GameMeta, "name">> {
  const first = (type: string) =>
    tags?.find((x) => x.type === type && x.tag)?.tag?.trim();

  const year = first("year") ?? first("releasedate")?.slice(0, 4);
  const rating = first("rating");
  const r = rating ? Number(rating.replace(/[^\d.]/g, "")) : NaN;

  return {
    releasedate: /^\d{4}$/.test(year ?? "") ? `${year}0101T000000` : undefined,
    developer: first("developer"),
    publisher: first("publisher"),
    players: first("players"),
    genre: first("genre") ?? first("category"),
    // gamelist ratings are 0..1; accept a 0..1, 0..5 or 0..10 tag.
    rating: Number.isFinite(r)
      ? (r > 5 ? r / 10 : r > 1 ? r / 5 : r).toFixed(2)
      : undefined,
  };
}

/**
 * Every game of the given systems (all of them when `systemIds` is empty),
 * walking `media.search` page by page. `onProgress` reports the running
 * count; `signal` aborts the walk.
 */
export async function zaparooGames(
  host: string,
  systemIds: string[],
  onProgress?: (count: number) => void,
  signal?: AbortSignal,
): Promise<ZaparooGame[]> {
  // Deduped by system + bare title: the first spelling wins, and any
  // metadata field a later regional dump has that the first one lacks is
  // filled in.
  const byKey = new Map<string, ZaparooGame>();
  const scope = systemIds.length ? { systems: systemIds } : {};
  let cursor: string | undefined;
  // A safety ceiling for a runaway collection.
  const MAX = 30000;

  do {
    if (signal?.aborted) throw new Error(t("Cancelled."));
    const page = await rpc<{
      results?: ZapMedia[];
      pagination?: { hasNextPage?: boolean; nextCursor?: string };
    }>(host, "media.search", {
      ...scope,
      sort: "name-asc",
      maxResults: 500,
      cursor,
    });

    for (const m of page.results ?? []) {
      if (!m.name || !m.system?.id) continue;
      const title = cleanRomTitle(m.name);
      const key = `${m.system.id} ${title.toLowerCase()}`;
      const meta = tagsToMeta(m.tags);
      const seen = byKey.get(key);
      if (seen) {
        for (const [k, v] of Object.entries(meta)) {
          if (v && !seen.meta[k as keyof typeof seen.meta]) {
            (seen.meta as Record<string, unknown>)[k] = v;
          }
        }
      } else {
        byKey.set(key, {
          systemId: m.system.id,
          systemName: m.system.name || m.system.id,
          title,
          meta,
        });
      }
    }
    onProgress?.(byKey.size);
    cursor =
      page.pagination?.hasNextPage && byKey.size < MAX
        ? page.pagination.nextCursor
        : undefined;
  } while (cursor);

  return [...byKey.values()];
}
