import { ChevronDown, ChevronRight, Gamepad2, Globe } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { CATALOG, gameKeyOf } from "../data/catalog";

interface Props {
  activeGameKey?: string;
  activeConsoleId?: string;
  activeGlobal: boolean;
  onPickGame: (consoleName: string, gameTitle: string, gameKey: string) => void;
  onOpenConsole: (consoleId: string, consoleName: string) => void;
  onOpenGlobal: () => void;
}

export function GameTree({
  activeGameKey,
  activeConsoleId,
  activeGlobal,
  onPickGame,
  onOpenConsole,
  onOpenGlobal,
}: Props) {
  const activeConsole = activeConsoleId ?? activeGameKey?.split("/")[0];
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    activeConsole ? { [activeConsole]: true } : { [CATALOG[0].id]: true },
  );

  return (
    <nav className="flex w-64 shrink-0 flex-col border-r bg-sidebar">
      <h2 className="px-3 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Konsolen &amp; Spiele
      </h2>

      <button
        className={cn(
          "mx-2 mb-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold hover:bg-accent",
          activeGlobal && "bg-primary/15 ring-1 ring-primary",
        )}
        title="Globale Vorlage – erscheint auf allen Karten"
        onClick={onOpenGlobal}
      >
        <Globe className="size-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate text-left">Alle Konsolen</span>
      </button>

      <ScrollArea className="min-h-0 flex-1">
        <ul className="px-2">
          {CATALOG.map((c) => {
            const expanded = !!open[c.id];
            return (
              <li key={c.id}>
                <Collapsible
                  open={expanded}
                  onOpenChange={(v) => setOpen((o) => ({ ...o, [c.id]: v }))}
                >
                  <div
                    className={cn(
                      "flex items-center gap-1 rounded-md",
                      activeConsoleId === c.id && "bg-primary/15 ring-1 ring-primary",
                    )}
                  >
                    <CollapsibleTrigger
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                      title={expanded ? "Zuklappen" : "Aufklappen"}
                    >
                      {expanded ? (
                        <ChevronDown className="size-3.5" />
                      ) : (
                        <ChevronRight className="size-3.5" />
                      )}
                    </CollapsibleTrigger>
                    <button
                      className="flex flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-sm font-semibold hover:bg-accent"
                      title={`${c.name} – gemeinsame Vorlage bearbeiten`}
                      onClick={() => onOpenConsole(c.id, c.name)}
                    >
                      <Gamepad2 className="size-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate text-left">{c.name}</span>
                      <Badge variant="secondary" className="rounded-full">
                        {c.games.length}
                      </Badge>
                    </button>
                  </div>

                  <CollapsibleContent className="ml-3 border-l pl-1">
                    {c.games.map((g, i) => {
                      const key = gameKeyOf(c, g);
                      const active = key === activeGameKey;
                      return (
                        <button
                          key={g.id}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[13px] transition-colors",
                            active
                              ? "bg-primary font-semibold text-primary-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground",
                          )}
                          title={g.title}
                          onClick={() => onPickGame(c.name, g.title, key)}
                        >
                          <span className="w-4 shrink-0 text-right text-[11px] tabular-nums opacity-70">
                            {i + 1}
                          </span>
                          <span className="flex-1 truncate">{g.title}</span>
                        </button>
                      );
                    })}
                  </CollapsibleContent>
                </Collapsible>
              </li>
            );
          })}
        </ul>
      </ScrollArea>

      <p className="border-t px-3 py-3 text-xs text-muted-foreground">
        <strong className="text-foreground">Konsolenname</strong> anklicken:
        gemeinsame Vorlage. <strong className="text-foreground">Spiel</strong>{" "}
        anklicken: dessen Sticker-Design.
      </p>
    </nav>
  );
}
