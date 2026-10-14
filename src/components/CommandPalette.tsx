import { CornerDownLeft, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { loadRecentCommands, rememberCommand, searchCommands, type Command } from "../commands";
import { useT } from "../i18n";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./ui/dialog";

// ⌘K / Ctrl K: type to find any action, card, console or layer and run it
// with Enter. Arrow keys move, Esc closes. Empty, it lists what was run
// last and the everyday actions.

export function CommandPalette({
  open,
  onOpenChange,
  commands,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  commands: Command[];
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  // Read once: the palette is mounted afresh each time it opens.
  const recent = useMemo(() => loadRecentCommands(), []);
  const results = useMemo(() => searchCommands(commands, query, recent), [commands, query, recent]);

  // A new query starts at the top.
  useEffect(() => setActive(0), [query]);
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Keep the highlighted row in view.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, results]);

  const run = (c: Command | undefined) => {
    if (!c) return;
    rememberCommand(c.id);
    onOpenChange(false);
    // After the palette has closed, so a dialog it opens keeps the focus.
    window.setTimeout(c.run, 60);
  };

  // Group headings appear where the group changes.
  const recentSet = !query.trim() ? new Set(recent) : null;
  const groupOf = (c: Command) => (recentSet?.has(c.id) ? t("Recent") : c.group);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="top-[18%] max-w-xl translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          document.getElementById("command-palette-input")?.focus();
        }}
      >
        <DialogTitle className="sr-only">{t("Command palette")}</DialogTitle>
        <DialogDescription className="sr-only">{t("Type to find an action, a card or a layer.")}</DialogDescription>
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            id="command-palette-input"
            className="h-11 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder={t("Type a command, card or layer …")}
            value={query}
            role="combobox"
            aria-expanded
            aria-controls="command-palette-list"
            aria-activedescendant={results[active] ? `cmd-${active}` : undefined}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => (results.length ? (a + 1) % results.length : 0));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => (results.length ? (a - 1 + results.length) % results.length : 0));
              } else if (e.key === "Enter") {
                e.preventDefault();
                run(results[active]);
              }
            }}
          />
          <kbd className="rounded border px-1.5 text-[10px] text-muted-foreground">Esc</kbd>
        </div>
        <div ref={listRef} id="command-palette-list" role="listbox" className="max-h-[52vh] overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t("Nothing matches.")}</p>
          ) : (
            results.map((c, i) => {
              const g = groupOf(c);
              const heading = i === 0 || groupOf(results[i - 1]) !== g;
              return (
                <div key={c.id}>
                  {heading && (
                    <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {g}
                    </div>
                  )}
                  <div
                    id={`cmd-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={i === active}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-md px-2.5 py-1.5 text-sm",
                      i === active ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                    )}
                    onMouseMove={() => i !== active && setActive(i)}
                    onClick={() => run(c)}
                  >
                    <span className="min-w-0 flex-1 truncate">{c.title}</span>
                    {c.hint && <span className="shrink-0 truncate text-xs text-muted-foreground">{c.hint}</span>}
                    {i === active && <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
