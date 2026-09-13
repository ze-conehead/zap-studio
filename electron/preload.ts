// Exposes a minimal, typed bridge to the renderer (see src/desktop.ts for
// the matching interface). contextIsolation is on and nodeIntegration is
// off, so this is the only way the page reaches anything in this process.
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktop", {
  isDesktop: true,
  apiFetch: (
    kind: "sgdb" | "igdb" | "twitch",
    path: string,
    init?: { method?: string; headers?: Record<string, string>; body?: string },
  ) => ipcRenderer.invoke("desktop:apiFetch", { kind, path, init }),
  zaparooRpc: (host: string, port: number, body: string) =>
    ipcRenderer.invoke("desktop:zaparooRpc", { host, port, body }),
});
