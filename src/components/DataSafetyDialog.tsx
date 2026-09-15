// Data safety: where the automatic backups go, and what is still recoverable
// from the trash.

import {
  AlertTriangle,
  FolderOpen,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import {
  chooseFolder,
  forgetFolder,
  isSupported,
  refreshStatus,
  runBackup,
  setSettings,
  STALE_DAYS,
  useBackupStatus,
} from "../autobackup";
import { useT } from "../i18n";
import { askConfirm } from "./ConfirmDialog";
import { formatBytes, STORAGE_WARN_RATIO, storageUsage, type StorageUsage } from "../storageUsage";
import {
  emptyTrash,
  listTrash,
  purgeTrashEntry,
  restoreProject,
  TRASH_DAYS,
  type TrashEntry,
} from "../persist";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Label } from "./ui/label";

const fmtDate = (ms: number) =>
  ms ? new Date(ms).toLocaleString() : "";

export function DataSafetyDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const status = useBackupStatus();
  const [trash, setTrash] = useState<TrashEntry[]>([]);
  const [usage, setUsage] = useState<StorageUsage | null>(null);
  useEffect(() => {
    if (open) void storageUsage().then(setUsage);
  }, [open, trash]);
  const [busy, setBusy] = useState(false);

  const reloadTrash = useCallback(() => {
    void listTrash().then(setTrash);
  }, []);

  useEffect(() => {
    if (!open) return;
    void refreshStatus();
    reloadTrash();
  }, [open, reloadTrash]);

  const pick = async () => {
    try {
      setBusy(true);
      await chooseFolder();
    } catch (e) {
      // An aborted folder picker is a normal outcome, not an error.
      if ((e as Error).name !== "AbortError") alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const backupNow = async () => {
    setBusy(true);
    await runBackup({ force: true, ask: true });
    setBusy(false);
  };

  const stale =
    status.lastAt > 0 && Date.now() - status.lastAt > STALE_DAYS * 86_400_000;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-2xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("Data safety")}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          {t(
            "Everything you design lives in this browser's local database. Clearing the browser's site data deletes it. Point the app at a folder and it keeps a rolling set of backup .zip files there for you.",
          )}
        </p>

        {/* ── storage ───────────────────────────────────────────────── */}
        {usage && (
          <section className="flex flex-col gap-2 rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <Label>{t("Storage")}</Label>
              <span className="text-xs tabular-nums text-muted-foreground">
                {usage.quota
                  ? t("{used} of {quota} used ({pct} %)", {
                      used: formatBytes(usage.usage),
                      quota: formatBytes(usage.quota),
                      pct: Math.round(usage.ratio * 100),
                    })
                  : t("{used} used", { used: formatBytes(usage.usage) })}
              </span>
            </div>
            {usage.quota > 0 && (
              <div className="h-1.5 overflow-hidden rounded bg-muted">
                <div
                  className={usage.ratio >= STORAGE_WARN_RATIO ? "h-full bg-amber-500" : "h-full bg-primary"}
                  style={{ width: `${Math.min(100, usage.ratio * 100)}%` }}
                />
              </div>
            )}
            {usage.ratio >= STORAGE_WARN_RATIO ? (
              <p className="flex items-center gap-1.5 text-xs text-amber-400">
                <AlertTriangle className="size-3.5 shrink-0" />
                {t("Storage is getting full — a full quota makes saves fail. Empty the trash, remove unused covers / logos, or back up and delete old projects.")}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("Images are stored inside the projects; the trash and the local cover / logo libraries count too.")}
              </p>
            )}
          </section>
        )}

        {/* ── automatic backups ─────────────────────────────────────── */}
        <section className="flex flex-col gap-3 rounded-md border p-3">
          <Label>{t("Automatic backup")}</Label>

          {!isSupported() ? (
            <p className="text-xs text-muted-foreground">
              {t(
                "This browser can't write to a folder (needs the File System Access API — Chrome, Edge or Opera). Use File ▸ Save backup (.zip) regularly instead.",
              )}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                {status.state === "off" ? (
                  <span className="text-muted-foreground">
                    {t("No folder selected yet.")}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <FolderOpen className="size-4 text-muted-foreground" />
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {status.folder}
                    </code>
                  </span>
                )}
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void pick()}>
                  {status.state === "off" ? t("Choose folder …") : t("Change folder …")}
                </Button>
                {status.state !== "off" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void forgetFolder().then(() => void refreshStatus())}
                  >
                    {t("Forget")}
                  </Button>
                )}
              </div>

              {status.state === "needs-permission" && (
                <p className="flex items-center gap-1.5 text-xs text-amber-400">
                  <AlertTriangle className="size-3.5 shrink-0" />
                  {t(
                    "The browser needs your permission again for this folder — click “Back up now”.",
                  )}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
                <label className="flex items-center gap-2">
                  <Checkbox
                    checked={status.settings.enabled}
                    onCheckedChange={(v) => setSettings({ enabled: !!v })}
                  />
                  {t("Back up automatically")}
                </label>
                <label className="flex items-center gap-1.5">
                  {t("at most every")}
                  <input
                    type="number"
                    min={5}
                    step={5}
                    className="h-7 w-16 rounded border bg-transparent px-2"
                    value={status.settings.everyMin}
                    onChange={(e) =>
                      setSettings({ everyMin: Math.max(5, Number(e.target.value) || 30) })
                    }
                  />
                  {t("min")}
                </label>
                <label className="flex items-center gap-1.5">
                  {t("keep")}
                  <input
                    type="number"
                    min={1}
                    step={1}
                    className="h-7 w-16 rounded border bg-transparent px-2"
                    value={status.settings.keep}
                    onChange={(e) =>
                      setSettings({ keep: Math.max(1, Number(e.target.value) || 10) })
                    }
                  />
                  {t("files")}
                </label>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">
                  {status.lastAt
                    ? t("Last backup: {when}", { when: fmtDate(status.lastAt) })
                    : t("No backup written yet.")}
                  {stale && (
                    <span className="ml-1.5 text-amber-400">
                      {t("— over {n} days ago", { n: STALE_DAYS })}
                    </span>
                  )}
                </span>
                <Button size="sm" disabled={busy || status.running} onClick={() => void backupNow()}>
                  {status.running || busy ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Save />
                  )}
                  {t("Back up now")}
                </Button>
              </div>

              {status.lastError && (
                <p className="text-xs text-destructive">{status.lastError}</p>
              )}
            </>
          )}
        </section>

        {/* ── trash ─────────────────────────────────────────────────── */}
        <section className="flex min-h-0 flex-col gap-2 rounded-md border p-3">
          <div className="flex items-center justify-between">
            <Label>
              {t("Trash")}{" "}
              <span className="font-normal text-muted-foreground">
                ({trash.length})
              </span>
            </Label>
            {trash.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={async () => {
                  const ok = await askConfirm({
                    title: t("Permanently delete everything in the trash?"),
                    confirmLabel: t("Empty trash"),
                    destructive: true,
                  });
                  if (ok) void emptyTrash().then(reloadTrash);
                }}
              >
                <Trash2 /> {t("Empty trash")}
              </Button>
            )}
          </div>

          {trash.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {t("Nothing deleted. Deleted designs stay here for {n} days.", {
                n: TRASH_DAYS,
              })}
            </p>
          ) : (
            <ul className="min-h-0 max-h-56 overflow-y-auto rounded border">
              {trash.map((e) => (
                <li
                  key={e.project.id}
                  className="flex items-center gap-2 border-b px-2 py-1.5 text-sm last:border-b-0"
                >
                  <span className="flex-1 truncate">{e.project.name}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {fmtDate(e.deletedAt)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7"
                    onClick={() => void restoreProject(e.project.id).then(reloadTrash)}
                  >
                    <RotateCcw /> {t("Restore")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() => void purgeTrashEntry(e.project.id).then(reloadTrash)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("Close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
