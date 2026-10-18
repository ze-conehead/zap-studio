import { ChevronDown, ChevronRight, Printer, Search } from "lucide-react";
import { useEffect, useState } from "react";
import type { PictureGap } from "../collection";
import { useT } from "../i18n";
import { printedKeys } from "../printed";
import { listSheetGames, type SheetGame } from "../sheet";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { PictureGapHint, usePictureGaps } from "./PictureGapHint";

// The game list of the "Export to print" dialogs: a tree like Settings ▸
// Manage metadata — one folding group per console, a tick per game or for
// the whole console, a search and a filter (gaps, printed). The selection is
// the caller's; what a filter hides stays selected, and says so.

type Filter = "all" | "ready" | "gaps" | "complete" | "unprinted" | "printed";

// With more games than this, the consoles start folded.
const OPEN_ALL_UP_TO = 300;

/**
 * What the export dialogs list and select: every game, with the cards that
 * are complete (cover and screenshots there) and not printed yet selected —
 * the picker's default filter shows the same ones. `gaps` is null while the
 * cards are still being checked.
 */
export function useExportSelection(open: boolean) {
  const [games, setGames] = useState<SheetGame[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const gaps = usePictureGaps(open);
  useEffect(() => {
    if (!open) return;
    setGames(listSheetGames());
    setPicked(new Set());
  }, [open]);
  useEffect(() => {
    if (!gaps) return;
    const printed = printedKeys();
    setPicked(new Set(listSheetGames().filter((g) => !gaps.has(g.gameKey) && !printed.has(g.gameKey)).map((g) => g.gameKey)));
  }, [gaps]);
  return { games, picked, setPicked, gaps };
}

export function GamePicker({
  games,
  picked,
  onChange,
  gaps,
  listClassName,
}: {
  games: SheetGame[];
  picked: Set<string>;
  onChange: (picked: Set<string>) => void;
  gaps: Map<string, PictureGap>;
  listClassName?: string;
}) {
  const t = useT();
  const [printed] = useState(printedKeys);
  const [query, setQuery] = useState("");
  // The default: what is ready to print. The hook below selects exactly those.
  const [filter, setFilter] = useState<Filter>("ready");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const q = query.trim().toLowerCase();
  const consoleOf = (g: SheetGame) => g.gameKey.split("/")[0];
  const shown = games.filter((g) => {
    if (q && !g.gameTitle.toLowerCase().includes(q)) return false;
    switch (filter) {
      case "ready":
        return !gaps.has(g.gameKey) && !printed.has(g.gameKey);
      case "gaps":
        return gaps.has(g.gameKey);
      case "complete":
        return !gaps.has(g.gameKey);
      case "unprinted":
        return !printed.has(g.gameKey);
      case "printed":
        return printed.has(g.gameKey);
      default:
        return true;
    }
  });

  const groups: { id: string; name: string; games: SheetGame[] }[] = [];
  for (const g of shown) {
    const id = consoleOf(g);
    let grp = groups.find((x) => x.id === id);
    if (!grp) groups.push((grp = { id, name: g.consoleName, games: [] }));
    grp.games.push(g);
  }

  const defaultOpen = games.length <= OPEN_ALL_UP_TO;
  const isOpen = (id: string) => !!q || (open[id] ?? defaultOpen);
  const setAllOpen = (v: boolean) => setOpen(Object.fromEntries(groups.map((x) => [x.id, v])));

  const set = (keys: string[], on: boolean) => {
    const n = new Set(picked);
    for (const k of keys) {
      if (on) n.add(k);
      else n.delete(k);
    }
    onChange(n);
  };
  const shownKeys = shown.map((g) => g.gameKey);
  const allShownPicked = shownKeys.length > 0 && shownKeys.every((k) => picked.has(k));
  const pickedPrinted = games.filter((g) => picked.has(g.gameKey) && printed.has(g.gameKey)).map((g) => g.gameKey);
  const pickedWarned = games.filter((g) => picked.has(g.gameKey) && gaps.has(g.gameKey)).map((g) => g.gameKey);
  const hiddenPicked = games.filter((g) => picked.has(g.gameKey) && !shownKeys.includes(g.gameKey)).length;

  const filterLabel: Record<Filter, string> = {
    all: t("All"),
    ready: t("Ready & not printed"),
    gaps: t("Cover or screenshots missing"),
    complete: t("Ready"),
    unprinted: t("Not printed yet"),
    printed: t("Printed"),
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-44 max-w-full">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 pl-8"
            placeholder={t("Search games …")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <SelectTrigger className="h-8 w-auto gap-2 px-2 text-xs" aria-label={t("Filter")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(filterLabel) as Filter[]).map((f) => (
              <SelectItem key={f} value={f}>
                {filterLabel[f]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => setAllOpen(true)}>
          {t("Expand all")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => setAllOpen(false)}>
          {t("Collapse all")}
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-md border">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          <span>
            {t("{n} of {total} selected", { n: picked.size, total: games.length })}
            {hiddenPicked > 0 && ` · ${t("{n} not shown by the filter", { n: hiddenPicked })}`}
          </span>
          <span className="flex flex-wrap items-center gap-1">
            <button
              type="button"
              className="rounded px-1.5 hover:bg-accent disabled:opacity-50"
              disabled={pickedWarned.length === 0}
              title={t("Takes every card with a warning (no cover, missing screenshots) out of the selection.")}
              onClick={() => set(pickedWarned, false)}
            >
              {t("Deselect with warnings")}
            </button>
            <button
              type="button"
              className="rounded px-1.5 hover:bg-accent disabled:opacity-50"
              disabled={pickedPrinted.length === 0}
              title={t("Takes every card marked as printed out of the selection.")}
              onClick={() => set(pickedPrinted, false)}
            >
              {t("Deselect printed")}
            </button>
            <button
              type="button"
              className="rounded px-1.5 hover:bg-accent disabled:opacity-50"
              disabled={shownKeys.length === 0}
              onClick={() => set(shownKeys, !allShownPicked)}
            >
              {allShownPicked ? t("Deselect all") : t("Select all")}
            </button>
          </span>
        </div>
        <ul className={cn("min-h-0 flex-1 overflow-y-auto text-sm", listClassName)}>
          {groups.map((grp) => {
            const keys = grp.games.map((g) => g.gameKey);
            const on = keys.filter((k) => picked.has(k)).length;
            const state = on === 0 ? false : on === keys.length ? true : "indeterminate";
            const expanded = isOpen(grp.id);
            return (
              <li key={grp.id} className="border-b last:border-b-0">
                <div className="flex items-center gap-2 bg-muted/60 px-2 py-1.5">
                  <Checkbox
                    aria-label={t("Select all of {name}", { name: grp.name })}
                    checked={state}
                    onCheckedChange={() => set(keys, state !== true)}
                  />
                  <button
                    type="button"
                    onClick={() => setOpen((o) => ({ ...o, [grp.id]: !expanded }))}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left font-semibold hover:text-primary"
                  >
                    {expanded ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                    <span className="truncate">{grp.name}</span>
                    <span className="shrink-0 font-normal text-muted-foreground">
                      ({on}/{keys.length})
                    </span>
                  </button>
                </div>
                {expanded &&
                  grp.games.map((g) => (
                    <label
                      key={g.gameKey}
                      className="flex cursor-pointer items-center gap-2 border-t py-1 pl-8 pr-2 hover:bg-muted/40"
                    >
                      <Checkbox checked={picked.has(g.gameKey)} onCheckedChange={(v) => set([g.gameKey], !!v)} />
                      <span className="truncate" title={g.gameTitle}>
                        {g.gameTitle}
                      </span>
                      <span className="ml-auto" />
                      <PictureGapHint gap={gaps.get(g.gameKey)} />
                      {printed.has(g.gameKey) && (
                        <span className="shrink-0 text-muted-foreground" title={t("Printed")}>
                          <Printer className="size-3" />
                        </span>
                      )}
                    </label>
                  ))}
              </li>
            );
          })}
          {groups.length === 0 && <li className="p-3 text-muted-foreground">{t("No game matches.")}</li>}
        </ul>
      </div>
    </div>
  );
}
