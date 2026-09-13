// The desktop shell. Everything the app itself needs lives in src/ and is
// built by Vite exactly as for the browser; this file only owns the window
// and the two proxies that only Node (never a browser tab) can do without
// CORS getting in the way — same allowlists as vite.config.ts's plugins,
// just reachable via IPC / a custom scheme instead of an HTTP route.
import { app, BrowserWindow, ipcMain, protocol } from "electron";
import path from "node:path";
import { WebSocket } from "ws";

// ── same allowlists as vite.config.ts — keep both in sync ─────────────────
const PRIVATE_HOST =
  /^(?:localhost|127(?:\.\d{1,3}){3}|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2}|169\.254(?:\.\d{1,3}){2}|\[?::1\]?|[\w-]+\.local)$/i;
const API_HOSTS: Record<string, string> = {
  sgdb: "https://www.steamgriddb.com/api/v2",
  igdb: "https://api.igdb.com/v4",
  twitch: "https://id.twitch.tv",
};
const IMG_HOSTS = [/(^|\.)steamgriddb\.com$/];

protocol.registerSchemesAsPrivileged([
  {
    scheme: "app-img",
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: "#161617",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  if (app.isPackaged) {
    void win.loadFile(path.join(__dirname, "../dist/index.html"));
  } else {
    void win.loadURL("http://localhost:5173");
  }
}

app.whenReady().then(() => {
  // "app-img://p/<encoded url>" — proxies the cover-art CDN, same allowlist
  // as coverImageProxy() in vite.config.ts. Used directly as an <img src> or
  // fetch()ed by src/image.ts; either way Chromium treats it like any other
  // same-scheme resource once it's a registered "standard" scheme.
  protocol.handle("app-img", async (request) => {
    let target: string;
    try {
      target = decodeURIComponent(new URL(request.url).pathname.slice(1));
    } catch {
      return new Response("bad request", { status: 400 });
    }
    let host = "";
    try {
      const u = new URL(target);
      if (u.protocol === "https:") host = u.hostname;
    } catch {
      /* invalid */
    }
    if (!host || !IMG_HOSTS.some((re) => re.test(host))) {
      return new Response("bad image url", { status: 400 });
    }
    try {
      const upstream = await fetch(target);
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "content-type": upstream.headers.get("content-type") ?? "application/octet-stream",
        },
      });
    } catch {
      return new Response("upstream error", { status: 502 });
    }
  });

  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// ── SteamGridDB / IGDB / Twitch passthrough — mirrors apiProxy() in
// vite.config.ts (a plain reverse proxy: forward method/headers/body,
// return status + body as-is). src/desktop.ts rebuilds a Response from it.
ipcMain.handle(
  "desktop:apiFetch",
  async (
    _e,
    args: {
      kind: keyof typeof API_HOSTS;
      path: string;
      init?: { method?: string; headers?: Record<string, string>; body?: string };
    },
  ) => {
    const base = API_HOSTS[args.kind];
    if (!base) return { status: 400, bodyBase64: "" };
    try {
      const res = await fetch(`${base}${args.path}`, {
        method: args.init?.method,
        headers: args.init?.headers,
        body: args.init?.body,
      });
      const buf = Buffer.from(await res.arrayBuffer());
      return { status: res.status, bodyBase64: buf.toString("base64") };
    } catch {
      return { status: 502, bodyBase64: "" };
    }
  },
);

// ── Zaparoo Core over its WebSocket transport — the same trick as
// zaparooProxy() in vite.config.ts: a Node WebSocket sends no Origin
// header, so it passes Zaparoo's CORS check even though nothing else on
// this machine would. `host` must be loopback / RFC-1918 / link-local /
// *.local (no SSRF).
ipcMain.handle(
  "desktop:zaparooRpc",
  (_e, args: { host: string; port: number; body: string }) => {
    const { host, port, body } = args;
    if (!PRIVATE_HOST.test(host)) return { error: "bad-host" as const };
    let reqId: unknown;
    try {
      reqId = (JSON.parse(body) as { id?: unknown }).id;
    } catch {
      return { error: "not-json" as const };
    }

    return new Promise((resolve) => {
      const ws = new WebSocket(`ws://${host}:${port}/api/v0.1`);
      const timer = setTimeout(() => {
        resolve({ error: "timeout" as const });
        try {
          ws.close();
        } catch {
          /* already closed */
        }
      }, 20000);

      ws.on("open", () => ws.send(body));
      ws.on("message", (data) => {
        let parsed: { id?: unknown } | undefined;
        try {
          parsed = JSON.parse(data.toString());
        } catch {
          return; // not JSON — ignore
        }
        if (parsed && "id" in parsed && parsed.id === reqId) {
          clearTimeout(timer);
          resolve({ text: data.toString() });
          try {
            ws.close();
          } catch {
            /* */
          }
        }
      });
      ws.on("error", () => {
        clearTimeout(timer);
        resolve({ error: "network" as const });
      });
      ws.on("close", () => {
        clearTimeout(timer);
        resolve({ error: "closed" as const });
      });
    });
  },
);
