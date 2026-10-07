import { DatabaseZap } from "lucide-react";
import { enterMemoryMode } from "../idb";
import { useT } from "../i18n";
import { Button } from "./ui/button";

// Shown instead of the app when the browser's IndexedDB can't be used (see
// src/idb.ts) — at start-up, or when the first read of the project fails.
// Nothing here touches the stored data: it explains, retries, or opens a
// temporary session that stores nothing.
export function StorageErrorScreen({ error }: { error: unknown }) {
  const t = useT();
  const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return (
    <div className="grid h-full place-items-center overflow-y-auto p-6">
      <div className="flex max-w-xl flex-col gap-4 rounded-lg border bg-card p-6 text-sm shadow-lg">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <DatabaseZap className="size-5 text-amber-500" />
          {t("The browser's storage isn't responding")}
        </h1>
        <p className="text-muted-foreground">
          {t("Zap-Studio keeps your projects in the browser's IndexedDB, and the browser reports an error when it tries to read it. Your data is not deleted by this screen.")}
        </p>
        <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-2 font-mono text-xs">{msg}</pre>

        <div>
          <p className="mb-1 font-medium">{t("What usually helps, in this order:")}</p>
          <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>{t("Quit the browser completely (⌘Q, not just the window), start it again and reopen the app. This clears a stuck lock after a crash or sleep.")}</li>
            <li>{t("Make sure the app isn't open in a second window or profile, and that the disk isn't full.")}</li>
            <li>{t("Still failing: your latest automatic backup is a zap-studio-backup_….zip in the folder you picked under Data safety. Open the app on another address (a different port, or another browser) and use File ▸ Import project … with that file.")}</li>
            <li>{t("Last resort: clear the site data for this address in the browser settings, then import the backup. That deletes whatever the broken storage still holds.")}</li>
          </ol>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => enterMemoryMode()}>
            {t("Open without saved data")}
          </Button>
          <Button onClick={() => location.reload()}>{t("Try again")}</Button>
        </div>
        <p className="text-xs text-muted-foreground">
          {t("“Open without saved data” starts an empty session that stores nothing — handy to import a backup and export from it. Closing the tab discards it.")}
        </p>
      </div>
    </div>
  );
}

// A small, always-visible reminder while running on the in-memory store.
export function MemoryModeBanner() {
  const t = useT();
  return (
    <div
      className="pointer-events-none fixed bottom-3 left-1/2 z-50 -translate-x-1/2 rounded-full border border-amber-500/40 bg-background/95 px-3 py-1 text-xs text-amber-500 shadow"
      role="status"
    >
      {t("Temporary session — nothing is saved. Export your work (File ▸ Export project as .zip) before closing.")}
    </div>
  );
}
