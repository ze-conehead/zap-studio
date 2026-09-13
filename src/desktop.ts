// The bridge to the Electron main process (electron/preload.ts exposes
// `window.desktop` there). Every caller checks isDesktop() first and falls
// back to the Vite dev/preview-server proxies (vite.config.ts) otherwise —
// so the same app code runs unmodified in the browser and in the packaged
// desktop app.

export type ZaparooRpcResult =
  | { text: string }
  | { error: "bad-host" | "not-json" | "timeout" | "closed" | "network" };

export interface DesktopBridge {
  isDesktop: true;
  /** A same-origin-restricted API call proxied through the main process —
   * SteamGridDB / IGDB / Twitch, mirroring apiProxy() in vite.config.ts. */
  apiFetch(
    kind: "sgdb" | "igdb" | "twitch" | "tmdb",
    path: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ): Promise<{ status: number; bodyBase64: string }>;
  /** Zaparoo Core JSON-RPC over its WebSocket transport, opened from the
   * main process so it carries no Origin header — see zaparooProxy() in
   * vite.config.ts for why that matters. */
  zaparooRpc(host: string, port: number, body: string): Promise<ZaparooRpcResult>;
}

declare global {
  interface Window {
    desktop?: DesktopBridge;
  }
}

export const isDesktop = (): boolean =>
  typeof window !== "undefined" && !!window.desktop?.isDesktop;

function base64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new ArrayBuffer(bin.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) view[i] = bin.charCodeAt(i);
  return buf;
}

/** Runs an API-proxy fetch through the desktop bridge and rebuilds a real
 * Response, so calling code (res.status, res.json() …) doesn't need to know
 * it isn't a normal same-origin fetch. */
export async function desktopApiFetch(
  kind: "sgdb" | "igdb" | "twitch" | "tmdb",
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const headers: Record<string, string> = {};
  if (init?.headers) new Headers(init.headers).forEach((v, k) => (headers[k] = v));
  const body = typeof init?.body === "string" ? init.body : undefined;
  const r = await window.desktop!.apiFetch(kind, path, { method: init?.method, headers, body });
  return new Response(base64ToBuffer(r.bodyBase64), { status: r.status });
}
