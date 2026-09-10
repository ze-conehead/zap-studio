import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plug,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { addConsole, addGame, getCatalog, slug } from "../data/catalog";
import { upsertGameMetaMany } from "../gamelist";
import { useT } from "../i18n";
import {
  getZaparooHost,
  setZaparooHost,
  zaparooGames,
  zaparooSystems,
  zaparooVersion,
  type ZaparooGame,
  type ZaparooSystem,
} from "../zaparoo";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

type Phase = "connect" | "pick" | "fetching" | "select" | "done";

const gameKey = (g: ZaparooGame) => `${g.systemId}/${slug(g.title)}`;

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
  const [sysPicked, setSysPicked] = useState<Set<string>>(new Set());

  const [games, setGames] = useState<ZaparooGame[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState("");

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
    setSysPicked(new Set());
    setGames([]);
    setPicked(new Set());
    setExpanded({});
    setFilter("");
    setProgress(0);
  }, [open]);

  useEffect(() => () => abort.current?.abort(), []);

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
      setSysPicked(new Set(list.map((s) => s.id)));
      if (list.length) setPhase("pick");
      else {
        setStats({ consoles: 0, games: 0 });
        setPhase("done");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const fetchGames = async () => {
    setPhase("fetching");
    setError("");
    setProgress(0);
    abort.current = new AbortController();
    try {
      const rows = await zaparooGames(
        host.trim(),
        [...sysPicked],
        setProgress,
        abort.current.signal,
      );
      setGames(rows);
      setPicked(new Set(rows.map(gameKey)));
      if (rows.length) setPhase("select");
      else {
        setStats({ consoles: 0, games: 0 });
        setPhase("done");
      }
    } catch (e) {
      setError((e as Error).message);
      setPhase("pick");
    } finally {
      abort.current = null;
    }
  };

  // Games grouped by system, filtered by the search box.
  const groups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    const by = new Map<string, ZaparooGame[]>();
    for (const g of games) {
      if (
        q &&
        !g.title.toLowerCase().includes(q) &&
        !g.systemName.toLowerCase().includes(q)
      ) {
        continue;
      }
      const arr = by.get(g.systemName) ?? [];
      arr.push(g);
      by.set(g.systemName, arr);
    }
    return [...by.entries()].map(([name, list]) => ({ name, list }));
  }, [games, filter]);

  const toggleGame = (g: ZaparooGame) =>
    setPicked((prev) => {
      const next = new Set(prev);
      const k = gameKey(g);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const toggleGroup = (list: ZaparooGame[]) => {
    const keys = list.map(gameKey);
    const allOn = keys.every((k) => picked.has(k));
    setPicked((prev) => {
      const next = new Set(prev);
      for (const k of keys) allOn ? next.delete(k) : next.add(k);
      return next;
    });
  };

  const run = () => {
    const chosen = games.filter((g) => picked.has(gameKey(g)));
    const byConsole = new Map<string, ZaparooGame[]>();
    for (const g of chosen) {
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
      const metaEntries: ({ name: string } & ZaparooGame["meta"])[] = [];
      for (const g of list) {
        const k = slug(g.title);
        if (seen.has(k)) continue;
        seen.add(k);
        addGame(id, g.title);
        metaEntries.push({ name: g.title, ...g.meta });
        added++;
      }
      upsertGameMetaMany(id, metaEntries);
    }

    setStats({ consoles: byConsole.size, games: added });
    setPhase("done");
  };

  const allSys = systems.length > 0 && sysPicked.size === systems.length;
  const sysGameCount = systems
    .filter((s) => sysPicked.has(s.id))
    .reduce((n, s) => n + (s.mediaCount ?? 0), 0);

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
                  disabled={busy || phase !== "connect"}
                  onChange={(e) => setHost(e.target.value)}
                  onKeyDown={(e) =>
                    e.key === "Enter" && phase === "connect" && void connect()
                  }
                />
                {phase === "connect" && (
                  <Button
                    disabled={!host.trim() || busy}
                    onClick={() => void connect()}
                  >
                    {busy ? <Loader2 className="animate-spin" /> : <Plug />}
                    {t("Connect")}
                  </Button>
                )}
              </div>
              {info && <span className="text-xs text-emerald-500">{info}</span>}
              {error && <span className="text-xs text-destructive">{error}</span>}
            </div>

            {/* ── pick systems to fetch ────────────────────────────────── */}
            {phase === "pick" && (
              <>
                <label className="flex items-center gap-2 text-sm font-medium">
                  <Checkbox
                    checked={allSys ? true : sysPicked.size ? "indeterminate" : false}
                    onCheckedChange={() =>
                      setSysPicked(
                        allSys ? new Set() : new Set(systems.map((s) => s.id)),
                      )
                    }
                  />
                  {t("{n} systems", { n: systems.length })}
                  <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                    {t("~{n} games", { n: sysGameCount })}
                  </span>
                </label>
                <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
                  <ul className="p-1">
                    {systems.map((s) => (
                      <li key={s.id}>
                        <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-accent">
                          <Checkbox
                            checked={sysPicked.has(s.id)}
                            onCheckedChange={() =>
                              setSysPicked((prev) => {
                                const next = new Set(prev);
                                next.has(s.id) ? next.delete(s.id) : next.add(s.id);
                                return next;
                              })
                            }
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
                    disabled={!sysPicked.size}
                    onClick={() => void fetchGames()}
                  >
                    {t("List games")}
                  </Button>
                </div>
              </>
            )}

            {phase === "fetching" && (
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

            {/* ── per-game selection tree ──────────────────────────────── */}
            {phase === "select" && (
              <>
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder={t("Filter …")}
                  className="h-8"
                />
                <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
                  <ul className="p-1">
                    {groups.map((g) => {
                      const keys = g.list.map(gameKey);
                      const on = keys.filter((k) => picked.has(k)).length;
                      const isOpen = filter.trim() ? true : !!expanded[g.name];
                      return (
                        <li key={g.name}>
                          <div className="flex items-center gap-1.5 rounded px-1.5 py-1">
                            <button
                              type="button"
                              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                              onClick={() =>
                                setExpanded((o) => ({ ...o, [g.name]: !o[g.name] }))
                              }
                            >
                              {isOpen ? (
                                <ChevronDown className="size-3.5" />
                              ) : (
                                <ChevronRight className="size-3.5" />
                              )}
                            </button>
                            <Checkbox
                              checked={
                                on === 0
                                  ? false
                                  : on === keys.length
                                    ? true
                                    : "indeterminate"
                              }
                              onCheckedChange={() => toggleGroup(g.list)}
                            />
                            <span className="flex-1 truncate text-sm font-medium">
                              {g.name}
                            </span>
                            <span className="text-xs tabular-nums text-muted-foreground">
                              {on}/{g.list.length}
                            </span>
                          </div>
                          {isOpen && (
                            <ul className="ml-6 border-l pl-2">
                              {g.list.map((game) => (
                                <li key={gameKey(game)}>
                                  <label
                                    className={cn(
                                      "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-accent",
                                    )}
                                  >
                                    <Checkbox
                                      checked={picked.has(gameKey(game))}
                                      onCheckedChange={() => toggleGame(game)}
                                    />
                                    <span className="flex-1 truncate">
                                      {game.title}
                                    </span>
                                    <span className="shrink-0 text-[11px] text-muted-foreground">
                                      {[
                                        game.meta.releasedate?.slice(0, 4),
                                        game.meta.genre,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </span>
                                  </label>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t("{n} game(s) selected", { n: picked.size })}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onOpenChange(false)}
                    >
                      {t("Cancel")}
                    </Button>
                    <Button size="sm" disabled={!picked.size} onClick={run}>
                      {t("Import games")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
