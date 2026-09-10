import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type ProxyOptions } from "vite";

// ── cover-art proxy ────────────────────────────────────────────────────────
// The cover-art sources (SteamGridDB API + CDN, IGDB, Twitch OAuth) don't
// send CORS headers, so the browser can't call them directly. Instead of a
// third-party CORS proxy we forward them from Vite's own server (Node, where
// CORS doesn't apply). Everything stays on this machine: an API key only
// travels browser → local Vite → the upstream over HTTPS.

const apiProxy: Record<string, ProxyOptions> = {
  "/api/sgdb": {
    target: "https://www.steamgriddb.com",
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api\/sgdb/, "/api/v2"),
  },
  "/api/igdb": {
    target: "https://api.igdb.com",
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api\/igdb/, "/v4"),
  },
  "/api/twitch": {
    target: "https://id.twitch.tv",
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api\/twitch/, ""),
  },
};

// ── Zaparoo proxy ─────────────────────────────────────────────────────────
// Zaparoo Core's HTTP API only sends CORS headers for a fixed origin
// allowlist (its own apps, zaparoo.app, bare http://localhost), so a browser
// on :5173 can't POST to it directly. Forward the JSON-RPC call from Node,
// where CORS doesn't apply. `POST /zaparoo?ip=<host>&port=<n>` — the host
// must be loopback or an RFC-1918 / link-local address (no arbitrary SSRF).
const PRIVATE_HOST =
  /^(?:localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|\[?::1\]?|[\w-]+\.local)$/i;

function zaparooProxy(): Plugin {
  const handler = async (
    req: {
      url?: string;
      method?: string;
      [Symbol.asyncIterator](): AsyncIterableIterator<Buffer>;
    },
    res: {
      statusCode: number;
      setHeader(k: string, v: string): void;
      end(body?: unknown): void;
    },
  ) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end("POST only");
    }
    const params = new URL(req.url ?? "", "http://localhost").searchParams;
    const host = (params.get("ip") ?? "").trim().replace(/^https?:\/\//, "").replace(/[/:].*$/, "");
    const port = /^\d{1,5}$/.test(params.get("port") ?? "") ? params.get("port") : "7497";
    if (!host || !PRIVATE_HOST.test(host)) {
      res.statusCode = 400;
      return res.end("bad or non-local host");
    }
    let body = "";
    for await (const chunk of req) body += chunk.toString();
    try {
      const upstream = await fetch(`http://${host}:${port}/api/v0.1`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        signal: AbortSignal.timeout(20000),
      });
      res.statusCode = upstream.status;
      res.setHeader(
        "content-type",
        upstream.headers.get("content-type") ?? "application/json",
      );
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch (e) {
      res.statusCode = 502;
      res.end((e as Error).message || "upstream error");
    }
  };
  return {
    name: "zaparoo-proxy",
    configureServer: (s) => void s.middlewares.use("/zaparoo", handler),
    configurePreviewServer: (s) => void s.middlewares.use("/zaparoo", handler),
  };
}

// SteamGridDB's image CDN also blocks cross-origin reads, which taints the
// export canvas. `/img?url=<cdn url>` streams the bytes back same-origin.
const IMG_HOSTS = [/(^|\.)steamgriddb\.com$/];

function coverImageProxy(): Plugin {
  const handler = async (
    req: { url?: string },
    res: {
      statusCode: number;
      setHeader(k: string, v: string): void;
      end(body?: unknown): void;
    },
  ) => {
    const target = new URL(req.url ?? "", "http://localhost").searchParams.get("url");
    let host = "";
    try {
      const u = new URL(target ?? "");
      if (u.protocol === "https:") host = u.hostname;
    } catch {
      /* invalid */
    }
    if (!host || !IMG_HOSTS.some((re) => re.test(host))) {
      res.statusCode = 400;
      return res.end("bad image url");
    }
    try {
      const upstream = await fetch(target!);
      res.statusCode = upstream.status;
      res.setHeader(
        "content-type",
        upstream.headers.get("content-type") ?? "application/octet-stream",
      );
      res.setHeader("cache-control", "public, max-age=86400");
      res.end(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      res.statusCode = 502;
      res.end("upstream error");
    }
  };
  return {
    name: "cover-image-proxy",
    configureServer: (s) => void s.middlewares.use("/img", handler),
    configurePreviewServer: (s) => void s.middlewares.use("/img", handler),
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), coverImageProxy(), zaparooProxy()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
});
