import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plug,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addConsole, addGame, getCatalog, slug } from "../data/catalog";
import { upsertGameMetaMany } from "../gamelist";
import { useT } from "../i18n";
import {
  getZaparooHost,
  setZaparooHost,
  zaparooGames,
  zaparooVersion,
  type ZaparooGame,
} from "../zaparoo";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

type Phase = "connect" | "loading" | "select" | "done";

const gameKey = (g: ZaparooGame) => `${g.systemId}/${slug(g.title)}`;

interface Group {
  name: string;
  list: ZaparooGame[];
}

function groupBySystem(games: ZaparooGame[]): Group[] {
  const by = new Map<string, ZaparooGame[]>();
  for (const g of games) {
    const arr = by.get(g.systemName) ?? [];
    arr.push(g);
    by.set(g.systemName, arr);
  }
  return [...by.entries()]
    .map(([name, list]) => ({ name, list }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// A scrollable, per-system expandable tree. Clicking a game or a whole
// system moves it to the other side — `side` only picks the affordance
// (▸ to send right, ✕ to send back).
function GameTree({
  groups,
  side,
  forceOpen,
  empty,
  onMoveGame,
  onMoveGroup,
}: {
  groups: Group[];
  side: "available" | "selected";
  forceOpen?: boolean;
  empty: string;
  onMoveGame: (g: ZaparooGame) => void;
  onMoveGroup: (list: ZaparooGame[]) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  if (!groups.length) {
    return (
      <p className="p-4 text-center text-xs text-muted-foreground">{empty}</p>
    );
  }
  const GameIcon = side === "available" ? ArrowRight : ArrowLeft;
  return (
    <ul className="p-1">
      {groups.map((g) => {
        const isOpen = forceOpen || !!expanded[g.name];
        return (
          <li key={g.name}>
            <div className="group flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-accent">
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
              <button
                type="button"
                className="flex flex-1 items-center gap-1.5 truncate text-left text-sm font-medium"
                onClick={() => onMoveGroup(g.list)}
              >
                <span className="flex-1 truncate">{g.name}</span>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {g.list.length}
                </span>
                <GameIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            </div>
            {isOpen && (
              <ul className="ml-6 border-l pl-2">
                {g.list.map((game) => (
                  <li key={gameKey(game)}>
                    <button
                      type="button"
                      className="group flex w-full cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-left text-[13px] hover:bg-accent"
                      onClick={() => onMoveGame(game)}
                    >
                      <span className="flex-1 truncate">{game.title}</span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {[game.meta.releasedate?.slice(0, 4), game.meta.genre]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                      <GameIcon className="size-3.5 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

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

  const [games, setGames] = useState<ZaparooGame[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
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
    setGames([]);
    setPicked(new Set());
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
      setPhase("loading");
      setProgress(0);
      abort.current = new AbortController();
      const rows = await zaparooGames(h, [], setProgress, abort.current.signal);
      setGames(rows);
      setPicked(new Set());
      if (rows.length) setPhase("select");
      else {
        setStats({ consoles: 0, games: 0 });
        setPhase("done");
      }
    } catch (e) {
      setError((e as Error).message);
      setPhase("connect");
    } finally {
      setBusy(false);
      abort.current = null;
    }
  };

  // Left tree — every game that hasn't been moved over yet, narrowed by
  // the filter box.
  const available = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return groupBySystem(
      games.filter(
        (g) =>
          !picked.has(gameKey(g)) &&
          (!q ||
            g.title.toLowerCase().includes(q) ||
            g.systemName.toLowerCase().includes(q)),
      ),
    );
  }, [games, filter, picked]);

  // Right tree — only what's been moved over.
  const selected = useMemo(
    () => groupBySystem(games.filter((g) => picked.has(gameKey(g)))),
    [games, picked],
  );

  const moveGame = (g: ZaparooGame) =>
    setPicked((prev) => {
      const next = new Set(prev);
      const k = gameKey(g);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const addGroup = (list: ZaparooGame[]) =>
    setPicked((prev) => new Set([...prev, ...list.map(gameKey)]));

  const removeGroup = (list: ZaparooGame[]) =>
    setPicked((prev) => {
      const drop = new Set(list.map(gameKey));
      return new Set([...prev].filter((k) => !drop.has(k)));
    });

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

  const big = phase === "select";

  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? null : onOpenChange(o))}>
      <DialogContent
        className={
          big
            ? "flex h-[88vh] max-w-5xl flex-col gap-4 sm:max-w-5xl"
            : "flex max-h-[85vh] max-w-lg flex-col gap-4"
        }
      >
        <DialogHeader>
          <DialogTitle>{t("Import from Zaparoo (MiSTer)")}</DialogTitle>
        </DialogHeader>

        {phase === "done" ? (
          <div className="flex flex-col gap-3 py-2">
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-emerald-500" />
              {stats.games > 0
                ? t(
                    "Imported {games} games across {consoles} systems — with metadata.",
                    stats,
                  )
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

            {phase === "loading" && (
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

            {phase === "select" && (
              <>
                <div className="grid min-h-0 flex-1 grid-cols-2 gap-3">
                  {/* ── all games ─────────────────────────────────────── */}
                  <div className="flex min-h-0 flex-col gap-2">
                    <Input
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                      placeholder={t("Filter …")}
                      className="h-8"
                    />
                    <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
                      <GameTree
                        groups={available}
                        side="available"
                        empty={t("No games found.")}
                        onMoveGame={moveGame}
                        onMoveGroup={addGroup}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t("{n} games available", {
                        n: games.length - picked.size,
                      })}
                    </span>
                  </div>

                  {/* ── the selection ─────────────────────────────────── */}
                  <div className="flex min-h-0 flex-col gap-2">
                    <div className="flex h-8 items-center gap-1.5 px-1 text-sm font-medium">
                      <ArrowRight className="size-3.5 text-muted-foreground" />
                      {t("Selected for import")}
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
                      <GameTree
                        groups={selected}
                        side="selected"
                        forceOpen
                        empty={t(
                          "Pick games or whole consoles on the left — they move here.",
                        )}
                        onMoveGame={moveGame}
                        onMoveGroup={removeGroup}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {t("{n} game(s) selected", { n: picked.size })}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-2">
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
              </>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
