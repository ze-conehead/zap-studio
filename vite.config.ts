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
  "/api/tmdb": {
    target: "https://api.themoviedb.org",
    changeOrigin: true,
    rewrite: (p) => p.replace(/^\/api\/tmdb/, "/3"),
  },
};

// ── Zaparoo proxy ─────────────────────────────────────────────────────────
// Zaparoo Core denies its HTTP JSON-RPC transport to any non-loopback
// client (403) unless `allowed_ips` is set, and its WebSocket transport
// checks the browser Origin against a fixed allowlist that doesn't include
// :5173. But the WS transport DOES accept an unauthenticated "legacy"
// client with no Origin header for read methods (version / systems /
// media.search) on MiSTer & friends. So this middleware opens that
// WebSocket from Node — where there is no Origin — sends the one JSON-RPC
// frame and returns the matching reply. `POST /zaparoo?ip=<host>&port=<n>`;
// the host must be loopback / RFC-1918 / link-local / *.local (no SSRF).
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
      writableEnded?: boolean;
      setHeader(k: string, v: string): void;
      end(body?: unknown): void;
    },
  ) => {
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end("POST only");
    }
    const params = new URL(req.url ?? "", "http://localhost").searchParams;
    const host = (params.get("ip") ?? "")
      .trim()
      .replace(/^wss?:\/\//, "")
      .replace(/^https?:\/\//, "")
      .replace(/[/:].*$/, "");
    const port = /^\d{1,5}$/.test(params.get("port") ?? "") ? params.get("port") : "7497";
    if (!host || !PRIVATE_HOST.test(host)) {
      res.statusCode = 400;
      return res.end("bad or non-local host");
    }

    let body = "";
    for await (const chunk of req) body += chunk.toString();
    let reqId: unknown;
    try {
      reqId = (JSON.parse(body) as { id?: unknown }).id;
    } catch {
      res.statusCode = 400;
      return res.end("bad JSON body");
    }

    const reply = (status: number, payload: string) => {
      if ("writableEnded" in res && res.writableEnded) return;
      res.statusCode = status;
      res.setHeader("content-type", "application/json");
      res.end(payload);
    };

    const ws = new WebSocket(`ws://${host}:${port}/api/v0.1`);
    const timer = setTimeout(() => {
      reply(504, JSON.stringify({ error: { message: "Zaparoo did not respond" } }));
      try {
        ws.close();
      } catch {
        /* already closed */
      }
    }, 20000);

    ws.addEventListener("open", () => ws.send(body));
    ws.addEventListener("message", (ev: { data: unknown }) => {
      const text =
        typeof ev.data === "string"
          ? ev.data
          : Buffer.from(ev.data as ArrayBuffer).toString();
      let parsed: { id?: unknown } | undefined;
      try {
        parsed = JSON.parse(text) as { id?: unknown };
      } catch {
        return; // not JSON — ignore
      }
      // Only our reply — skip notifications and unrelated frames.
      if (parsed && "id" in parsed && parsed.id === reqId) {
        clearTimeout(timer);
        reply(200, text);
        try {
          ws.close();
        } catch {
          /* */
        }
      }
    });
    ws.addEventListener("error", () => {
      clearTimeout(timer);
      reply(
        502,
        JSON.stringify({ error: { message: "can't reach Zaparoo at this address" } }),
      );
    });
    ws.addEventListener("close", () => {
      clearTimeout(timer);
      reply(
        502,
        JSON.stringify({ error: { message: "the connection closed before a reply" } }),
      );
    });
  };
  return {
    name: "zaparoo-proxy",
    configureServer: (s) => void s.middlewares.use("/zaparoo", handler),
    configurePreviewServer: (s) => void s.middlewares.use("/zaparoo", handler),
  };
}

// SteamGridDB's image CDN also blocks cross-origin reads, which taints the
// export canvas. `/img?url=<cdn url>` streams the bytes back same-origin.
// TMDB's image CDN is the movie-poster equivalent.
const IMG_HOSTS = [/(^|\.)steamgriddb\.com$/, /(^|\.)tmdb\.org$/];

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
  // Electron loads the packaged build over file://, where absolute asset
  // paths (Vite's default) resolve to the filesystem root instead of next
  // to index.html — relative paths work in both that and the dev server.
  base: "./",
  plugins: [react(), tailwindcss(), coverImageProxy(), zaparooProxy()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
});
