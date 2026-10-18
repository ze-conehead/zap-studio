import { ChevronDown, ChevronRight, History, Printer, Search } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { gameKeyOf, getCatalog, getCatalogVersion, subscribeCatalog } from "../data/catalog";
import { useT } from "../i18n";
import {
  getPrintedVersion,
  lastExportKeys,
  printedKeys,
  setPrinted,
  subscribePrinted,
} from "../printed";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";

// Settings ▸ Printed cards: every game in one table, grouped by console (each
// group folds away). The ticks only select — nothing is saved until
// "Mark as printed" (or "… not printed") is pressed for the selection, which
// then starts over. Printed games carry a printer icon. "Last export"
// selects the games the last "all cards" export (PNG .zip or PDF) was
// started with.

const OPEN_ALL_UP_TO = 300;

type Show = "all" | "printed" | "open";

export function PrintedCardsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  useSyncExternalStore(subscribeCatalog, getCatalogVersion, getCatalogVersion);
  useSyncExternalStore(subscribePrinted, getPrintedVersion, getPrintedVersion);

  const consoles = getCatalog();
  const printed = printedKeys();
  const total = consoles.reduce((n, c) => n + c.games.length, 0);
  const allKeys = new Set(consoles.flatMap((c) => c.games.map((g) => gameKeyOf(c, g))));
  const printedCount = [...printed].filter((k) => allKeys.has(k)).length;
  const last = lastExportKeys().filter((k) => allKeys.has(k));

  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [expanded, setExpanded] = useState<Set<string>>(() =>
    total <= OPEN_ALL_UP_TO ? new Set(consoles.map((c) => c.id)) : new Set(),
  );
  const q = query.trim().toLowerCase();
  const toggle = (id: string) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const select = (keys: string[], on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      for (const k of keys) {
        if (on) n.add(k);
        else n.delete(k);
      }
      return n;
    });

  const tickLastExport = () => {
    select(last, true);
    // Open the consoles those games are in, so the ticks are visible.
    const ids = new Set(last.map((k) => k.split("/")[0]));
    setExpanded((s) => new Set([...s, ...ids]));
    setShow("all");
  };

  // Only what is selected, and still exists.
  const picked = [...selected].filter((k) => allKeys.has(k));
  const apply = (value: boolean) => {
    setPrinted(picked, value);
    setSelected(new Set());
  };
  const pickedPrinted = picked.filter((k) => printed.has(k)).length;

  const visible = (c: (typeof consoles)[number]) =>
    c.games.filter((g) => {
      const done = printed.has(gameKeyOf(c, g));
      if (show === "printed" && !done) return false;
      if (show === "open" && done) return false;
      return !q || g.title.toLowerCase().includes(q);
    });

  const shownAny = consoles.some((c) => visible(c).length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[88vh] max-w-2xl flex-col gap-3">
        <DialogHeader>
          <DialogTitle>{t("Printed cards")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-52 max-w-full">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-8"
              placeholder={t("Search games …")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-0.5 rounded-md border p-0.5 text-xs">
            {(["all", "open", "printed"] as Show[]).map((s) => (
              <button
                key={s}
                type="button"
                className={cn("rounded px-2 py-1", show === s ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
                onClick={() => setShow(s)}
              >
                {s === "all" ? t("All") : s === "open" ? t("Not printed") : t("Printed")}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={() => setExpanded(new Set(consoles.map((c) => c.id)))}>
            {t("Expand all")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExpanded(new Set())}>
            {t("Collapse all")}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-muted-foreground">
            {t("{n} of {total} printed", { n: printedCount, total })}
          </span>
          <div className="ml-auto" />
          <Button
            variant="outline"
            size="sm"
            disabled={last.length === 0}
            title={
              last.length === 0
                ? t("No export has been started yet.")
                : t("Selects the games that were selected in the last “all cards” export (PNG .zip or PDF).")
            }
            onClick={tickLastExport}
          >
            <History /> {t("Select last export ({n})", { n: last.length })}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-2 py-1.5">
          <span className="text-sm">{t("{n} selected", { n: picked.length })}</span>
          <Button variant="ghost" size="sm" disabled={picked.length === 0} onClick={() => setSelected(new Set())}>
            {t("Clear selection")}
          </Button>
          <div className="ml-auto" />
          <Button variant="outline" size="sm" disabled={pickedPrinted === 0} onClick={() => apply(false)}>
            {t("Mark as not printed")}
          </Button>
          <Button size="sm" disabled={pickedPrinted === picked.length} onClick={() => apply(true)}>
            <Printer /> {t("Mark as printed")}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-md border">
          <ul className="text-sm">
            {consoles.map((c) => {
              const games = visible(c);
              if ((q || show !== "all") && games.length === 0) return null;
              const isOpen = !!q || show !== "all" || expanded.has(c.id);
              const all = c.games.map((g) => gameKeyOf(c, g));
              const done = all.filter((k) => printed.has(k)).length;
              // The console's tick selects the games shown in it.
              const keys = games.map((g) => gameKeyOf(c, g));
              const on = keys.filter((k) => selected.has(k)).length;
              const state = on === 0 ? false : on === keys.length ? true : "indeterminate";
              return (
                <li key={c.id} className="border-b last:border-b-0">
                  <div className="flex items-center gap-2 bg-muted/60 px-2 py-1.5">
                    <Checkbox
                      aria-label={t("Select all of {name}", { name: c.name })}
                      checked={state}
                      disabled={keys.length === 0}
                      onCheckedChange={() => select(keys, state !== true)}
                    />
                    <button
                      type="button"
                      onClick={() => toggle(c.id)}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left font-semibold hover:text-primary"
                    >
                      {isOpen ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                      <span className="truncate">{c.name}</span>
                      <span className="shrink-0 font-normal text-muted-foreground">
                        ({done}/{all.length})
                      </span>
                    </button>
                  </div>
                  {isOpen &&
                    games.map((g) => {
                      const key = gameKeyOf(c, g);
                      return (
                        <label
                          key={g.id}
                          className="flex cursor-pointer items-center gap-2 border-t py-1 pl-8 pr-2 hover:bg-muted/40"
                        >
                          <Checkbox checked={selected.has(key)} onCheckedChange={(v) => select([key], !!v)} />
                          <span className="truncate" title={g.title}>
                            {g.title}
                          </span>
                          {printed.has(key) && (
                            <span className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                              <Printer className="size-3" /> {t("Printed")}
                            </span>
                          )}
                        </label>
                      );
                    })}
                </li>
              );
            })}
          </ul>
          {!shownAny && (
            <p className="p-4 text-sm text-muted-foreground">
              {q ? t("No game matches.") : t("Nothing to show.")}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
