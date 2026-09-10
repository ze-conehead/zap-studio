import { CheckCircle2, Loader2, Plug } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { addConsole, getCatalog, addGame, slug } from "../data/catalog";
import { upsertGameMetaMany } from "../gamelist";
import { useT } from "../i18n";
import {
  getZaparooHost,
  setZaparooHost,
  zaparooGames,
  zaparooSystems,
  zaparooVersion,
  type ZaparooSystem,
} from "../zaparoo";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

type Phase = "connect" | "select" | "run" | "done";

export function ZaparooImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>("connect");
  const [host, setHost] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [systems, setSystems] = useState<ZaparooSystem[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState({ consoles: 0, games: 0 });
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!open) return;
    setPhase("connect");
    setHost(getZaparooHost());
    setError("");
    setInfo("");
    setBusy(false);
    setSystems([]);
    setPicked(new Set());
    setProgress(0);
  }, [open]);

  useEffect(
    () => () => abort.current?.abort(),
    [],
  );

  const connect = async () => {
    const h = host.trim();
    if (!h) return;
    setBusy(true);
    setError("");
    try {
      const v = await zaparooVersion(h);
      setInfo(t("Connected to Zaparoo {version} on {platform}.", v));
      setZaparooHost(h);
      const list = await zaparooSystems(h);
      setSystems(list);
      setPicked(new Set(list.map((s) => s.id)));
      setPhase(list.length ? "select" : "done");
      if (!list.length) setStats({ consoles: 0, games: 0 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allOn = systems.length > 0 && picked.size === systems.length;
  const pickedCount = systems
    .filter((s) => picked.has(s.id))
    .reduce((n, s) => n + (s.mediaCount ?? 0), 0);

  const run = async () => {
    setPhase("run");
    setBusy(true);
    setError("");
    setProgress(0);
    abort.current = new AbortController();
    try {
      const games = await zaparooGames(
        host.trim(),
        [...picked],
        setProgress,
        abort.current.signal,
      );

      const byConsole = new Map<string, typeof games>();
      for (const g of games) {
        const arr = byConsole.get(g.systemName) ?? [];
        arr.push(g);
        byConsole.set(g.systemName, arr);
      }

      let added = 0;
      for (const [name, list] of byConsole) {
        const id =
          getCatalog().find((c) => c.id === slug(name))?.id ??
          addConsole(name)?.id ??
          slug(name);
        const seen = new Set<string>();
        const metaEntries: ({ name: string } & (typeof list)[number]["meta"])[] = [];
        for (const g of list) {
          const key = slug(g.title);
          if (seen.has(key)) continue;
          seen.add(key);
          addGame(id, g.title);
          metaEntries.push({ name: g.title, ...g.meta });
          added++;
        }
        upsertGameMetaMany(id, metaEntries);
      }

      setStats({ consoles: byConsole.size, games: added });
      setPhase("done");
    } catch (e) {
      setError((e as Error).message);
      setPhase("select");
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? null : onOpenChange(o))}>
      <DialogContent className="flex max-h-[85vh] max-w-lg flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("Import from Zaparoo (MiSTer)")}</DialogTitle>
        </DialogHeader>

        {phase === "done" ? (
          <div className="flex flex-col gap-3 py-2">
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-emerald-500" />
              {stats.games > 0
                ? t("Imported {games} games across {consoles} systems — with metadata.", stats)
                : t("Nothing to import.")}
            </p>
            <Button onClick={() => onOpenChange(false)}>{t("Close")}</Button>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <span className="text-xs text-muted-foreground">
                {t(
                  "Address of the MiSTer (or other Zaparoo device). The dev server forwards the request — Zaparoo Core must be running.",
                )}
              </span>
              <div className="flex gap-1.5">
                <Input
                  autoFocus
                  value={host}
                  placeholder="192.168.1.50"
                  disabled={busy}
                  onChange={(e) => setHost(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && phase === "connect" && void connect()}
                />
                <Button disabled={!host.trim() || busy} onClick={() => void connect()}>
                  {busy && phase === "connect" ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Plug />
                  )}
                  {t("Connect")}
                </Button>
              </div>
              {info && <span className="text-xs text-emerald-500">{info}</span>}
              {error && <span className="text-xs text-destructive">{error}</span>}
            </div>

            {phase === "select" && (
              <>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={allOn ? true : picked.size ? "indeterminate" : false}
                    onCheckedChange={() =>
                      setPicked(allOn ? new Set() : new Set(systems.map((s) => s.id)))
                    }
                  />
                  {t("{n} systems", { n: systems.length })}
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {t("~{n} games", { n: pickedCount })}
                  </span>
                </label>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
                  <ul className="p-1">
                    {systems.map((s) => (
                      <li key={s.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                          <Checkbox
                            checked={picked.has(s.id)}
                            onCheckedChange={() => toggle(s.id)}
                          />
                          <span className="flex-1 truncate">{s.name}</span>
                          <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                            {s.mediaCount ?? "?"}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                    {t("Cancel")}
                  </Button>
                  <Button
                    size="sm"
                    disabled={!picked.size}
                    onClick={() => void run()}
                  >
                    {t("Import games")}
                  </Button>
                </div>
              </>
            )}

            {phase === "run" && (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("Fetching games … {n}", { n: progress })}
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto"
                  onClick={() => abort.current?.abort()}
                >
                  {t("Cancel")}
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
