// "Fetch metadata for all games": the per-card TMDB / IGDB fetch, run over
// every game of one console in sequence (the services rate-limit, and one
// at a time keeps the error list readable). Only fields a service returned
// are written — same rule as the single-card button.

import { CloudDownload, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getCatalog } from "../data/catalog";
import { findMeta, loadGamelist, upsertGameMeta } from "../gamelist";
import { useT } from "../i18n";
import { fetchGameMeta, fetchMovieMeta } from "../metaFetch";
import { getWorkspaceKind } from "../workspace";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

type Phase = "pick" | "running" | "done";

interface Failure {
  title: string;
  error: string;
}

export function MetaSweepDialog({
  open,
  onOpenChange,
  consoleId,
  consoleName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consoleId: string;
  consoleName: string;
}) {
  const t = useT();
  const isMovies = getWorkspaceKind() === "movies";
  const [phase, setPhase] = useState<Phase>("pick");
  const [skipExisting, setSkipExisting] = useState(false);
  const [done, setDone] = useState(0);
  const [total, setTotal] = useState(0);
  const [ok, setOk] = useState(0);
  const [failures, setFailures] = useState<Failure[]>([]);
  const cancelled = useRef(false);

  const titles = getCatalog().find((c) => c.id === consoleId)?.games.map((g) => g.title) ?? [];
  const existing = loadGamelist(consoleId);
  const withEntry = titles.filter((title) => !!findMeta(existing, title)).length;

  useEffect(() => {
    if (!open) return;
    setPhase("pick");
    setDone(0);
    setOk(0);
    setFailures([]);
    cancelled.current = false;
  }, [open]);

  const start = async () => {
    const todo = skipExisting
      ? titles.filter((title) => !findMeta(existing, title))
      : titles;
    setTotal(todo.length);
    setDone(0);
    setOk(0);
    setFailures([]);
    setPhase("running");
    let good = 0;
    const bad: Failure[] = [];
    for (const title of todo) {
      if (cancelled.current) break;
      try {
        const patch = await (isMovies ? fetchMovieMeta(title) : fetchGameMeta(title));
        if (Object.keys(patch).length) {
          upsertGameMeta(consoleId, title, patch);
          good++;
        } else {
          bad.push({ title, error: t("Found it, but it carries no usable details.") });
        }
      } catch (e) {
        bad.push({ title, error: (e as Error).message });
      }
      setDone((n) => n + 1);
      setOk(good);
      setFailures([...bad]);
    }
    setPhase("done");
  };

  const close = () => {
    cancelled.current = true;
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="flex max-h-[88vh] max-w-md flex-col gap-4">
        <DialogHeader>
          <DialogTitle>
            {isMovies
              ? t("Fetch metadata for all movies")
              : t("Fetch metadata for all games")}
          </DialogTitle>
        </DialogHeader>

        {phase === "pick" && (
          <>
            <p className="text-sm text-muted-foreground">
              {isMovies
                ? t("{n} movie(s) in “{console}” — looked up one by one on TMDB. Fields the service returns overwrite what is there; anything else is left alone.", {
                    n: titles.length,
                    console: consoleName,
                  })
                : t("{n} game(s) in “{console}” — looked up one by one on IGDB. Fields the service returns overwrite what is there; anything else is left alone.", {
                    n: titles.length,
                    console: consoleName,
                  })}
            </p>
            {withEntry > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={skipExisting}
                  onCheckedChange={(v) => setSkipExisting(!!v)}
                />
                {t("Skip the {n} that already have an entry", { n: withEntry })}
              </label>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={close}>
                {t("Cancel")}
              </Button>
              <Button size="sm" disabled={titles.length === 0} onClick={() => void start()}>
                <CloudDownload /> {t("Start")}
              </Button>
            </div>
          </>
        )}

        {phase === "running" && (
          <>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {t("{done} / {total} …", { done, total })}
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-primary transition-[width]"
                style={{ width: `${total ? (done / total) * 100 : 0}%` }}
              />
            </div>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={close}>
                {t("Cancel")}
              </Button>
            </div>
          </>
        )}

        {phase === "done" && (
          <>
            <p className="text-sm">
              {t("{ok} of {total} updated.", { ok, total })}
            </p>
            {failures.length > 0 && (
              <ul className="max-h-48 overflow-y-auto rounded-md border text-xs">
                {failures.map((f) => (
                  <li key={f.title} className="border-b px-2.5 py-1.5 last:border-b-0">
                    <span className="font-medium">{f.title}</span>
                    <span className="text-muted-foreground"> — {f.error}</span>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <Button size="sm" onClick={close}>
                {t("Close")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
