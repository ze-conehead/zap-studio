import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import {
  applyQuickImport,
  findGamesWithoutImage,
  type QuickImportResult,
  type QuickImportRow,
} from "../quickImport";
import { useT } from "../i18n";
import type { ImageLayer } from "../types";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Input } from "./ui/input";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentGameKey?: string;
  onAddLayerToCurrent: (layer: ImageLayer) => void;
}

type Phase = "loading" | "editing" | "running" | "done";

export function QuickImportDialog({
  open,
  onOpenChange,
  currentGameKey,
  onAddLayerToCurrent,
}: Props) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>("loading");
  const [rows, setRows] = useState<QuickImportRow[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [results, setResults] = useState<QuickImportResult[]>([]);

  useEffect(() => {
    if (!open) return;
    setPhase("loading");
    setUrls({});
    setResults([]);
    let cancelled = false;
    findGamesWithoutImage().then((r) => {
      if (cancelled) return;
      setRows(r);
      setPhase("editing");
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const resultByKey = new Map(results.map((r) => [r.gameKey, r]));
  const pending = phase === "done" ? rows.filter((r) => !resultByKey.get(r.gameKey)?.ok) : rows;
  const filledCount = pending.filter((r) => urls[r.gameKey]?.trim()).length;

  async function run() {
    const entries = pending
      .map((r) => ({ ...r, url: urls[r.gameKey]?.trim() ?? "" }))
      .filter((e) => e.url);
    if (!entries.length) return;
    setPhase("running");
    setProgress({ done: 0, total: entries.length });
    const res = await applyQuickImport(entries, {
      currentGameKey,
      addToCurrent: onAddLayerToCurrent,
      onProgress: (done, total) => setProgress({ done, total }),
    });
    // keep earlier successes when re-running after fixing failed rows
    setResults((prev) => [
      ...prev.filter((p) => !res.some((r) => r.gameKey === p.gameKey)),
      ...res,
    ]);
    // clear the URL inputs that succeeded
    setUrls((prev) => {
      const next = { ...prev };
      for (const r of res) if (r.ok) delete next[r.gameKey];
      return next;
    });
    setPhase("done");
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>Quick Import</DialogTitle>
          <DialogDescription>
            {t("Games without an image. Enter one image URL each and click \u201cDone\u201d – the images are loaded and added as a layer to each design.")}
          </DialogDescription>
        </DialogHeader>

        {phase === "loading" && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {t("Checking games …")}
          </div>
        )}

        {phase !== "loading" && rows.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {t("Every game already has an image.")}
          </p>
        )}

        {phase !== "loading" && rows.length > 0 && (
          <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-muted/95 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">{t("Console")}</th>
                  <th className="px-3 py-2 text-left font-medium">{t("Game")}</th>
                  <th className="px-3 py-2 text-left font-medium">URL</th>
                  <th className="w-8 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const res = resultByKey.get(r.gameKey);
                  return (
                    <tr key={r.gameKey} className="border-t align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                        {r.consoleName}
                      </td>
                      <td className="px-3 py-2">{r.gameTitle}</td>
                      <td className="px-3 py-2">
                        {res?.ok ? (
                          <span className="text-xs text-muted-foreground">
                            {t("loaded")}
                          </span>
                        ) : (
                          <Input
                            value={urls[r.gameKey] ?? ""}
                            onChange={(e) =>
                              setUrls((u) => ({ ...u, [r.gameKey]: e.target.value }))
                            }
                            placeholder="https://…"
                            disabled={phase === "running"}
                            className="h-8"
                          />
                        )}
                        {res && !res.ok && (
                          <p className="mt-1 text-xs text-destructive">{res.error}</p>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {res?.ok && (
                          <CheckCircle2 className="size-4 text-emerald-500" />
                        )}
                        {res && !res.ok && (
                          <XCircle className="size-4 text-destructive" />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter className="items-center gap-2 sm:justify-between">
          <span className="text-xs text-muted-foreground">
            {phase === "running"
              ? t("Loading … {done}/{total}", { done: progress.done, total: progress.total })
              : phase === "done"
                ? t("{ok} loaded", { ok: okCount }) +
                  (failCount ? t(", {fail} failed", { fail: failCount }) : "")
                : rows.length > 0
                  ? t("{filled} of {total} filled in", { filled: filledCount, total: pending.length })
                  : ""}
          </span>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {phase === "done" ? t("Close") : t("Cancel")}
            </Button>
            {rows.length > 0 && (
              <Button onClick={run} disabled={phase === "running" || filledCount === 0}>
                {phase === "running" && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {t("Done")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
