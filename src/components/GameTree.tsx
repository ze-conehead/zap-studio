import { ChevronDown, ChevronRight, Gamepad2, Globe } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  addGame,
  gameKeyOf,
  getCatalog,
  getCatalogVersion,
  removeGame,
  renameConsole,
  renameGame,
  subscribeCatalog,
} from "../data/catalog";
import { renameGameMeta } from "../gamelist";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";

interface Props {
  activeGameKey?: string;
  activeConsoleId?: string;
  activeGlobal: boolean;
  onPickGame: (consoleName: string, gameTitle: string, gameKey: string) => void;
  onOpenConsole: (consoleId: string, consoleName: string) => void;
  onOpenGlobal: () => void;
}

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

export function GameTree({
  activeGameKey,
  activeConsoleId,
  activeGlobal,
  onPickGame,
  onOpenConsole,
  onOpenGlobal,
}: Props) {
  // Re-render when a game is added/removed elsewhere (right-click menu).
  useSyncExternalStore(subscribeCatalog, getCatalogVersion, getCatalogVersion);
  const catalog = getCatalog();

  const activeConsole = activeConsoleId ?? activeGameKey?.split("/")[0];
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    activeConsole ? { [activeConsole]: true } : { [catalog[0]?.id ?? ""]: true },
  );
  const [menu, setMenu] = useState<MenuState | null>(null);

  const expand = (consoleId: string) =>
    setOpen((o) => ({ ...o, [consoleId]: true }));

  const handleAddGame = (consoleId: string, consoleName: string) => {
    const title = window.prompt(`Neues Spiel für ${consoleName}:`)?.trim();
    if (!title) return;
    const game = addGame(consoleId, title);
    if (game) expand(consoleId);
  };

  const handleRemoveGame = (consoleId: string, game: { id: string; title: string }) => {
    if (
      window.confirm(
        `„${game.title}" aus der Liste entfernen? Ein bereits angelegtes Sticker-Design bleibt unter „Projekte" erhalten.`,
      )
    ) {
      removeGame(consoleId, game.id);
    }
  };

  const handleRenameGame = (consoleId: string, game: { id: string; title: string }) => {
    const next = window.prompt("Spiel umbenennen:", game.title)?.trim();
    if (!next || next === game.title) return;
    if (renameGame(consoleId, game.id, next)) {
      // keep the gamelist.xml entry (matched by title) attached
      renameGameMeta(consoleId, game.title, next);
    }
  };

  const handleRenameConsole = (consoleId: string, consoleName: string) => {
    const next = window.prompt("Konsole umbenennen:", consoleName)?.trim();
    if (!next || next === consoleName) return;
    renameConsole(consoleId, next);
  };

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
          {catalog.map((c) => {
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
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenu({
                        x: e.clientX,
                        y: e.clientY,
                        items: [
                          {
                            label: "Hinzufügen",
                            onSelect: () => handleAddGame(c.id, c.name),
                          },
                          {
                            label: "Umbenennen",
                            onSelect: () => handleRenameConsole(c.id, c.name),
                          },
                        ],
                      });
                    }}
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
                      title={`${c.name} – gemeinsame Vorlage bearbeiten (Rechtsklick: Spiel hinzufügen / Konsole umbenennen)`}
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
                          title={`${g.title} (Rechtsklick: umbenennen / entfernen)`}
                          onClick={() => onPickGame(c.name, g.title, key)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMenu({
                              x: e.clientX,
                              y: e.clientY,
                              items: [
                                {
                                  label: "Umbenennen",
                                  onSelect: () => handleRenameGame(c.id, g),
                                },
                                {
                                  label: "Entfernen",
                                  destructive: true,
                                  onSelect: () => handleRemoveGame(c.id, g),
                                },
                              ],
                            });
                          }}
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
        anklicken: dessen Sticker-Design. <strong className="text-foreground">Rechtsklick</strong>:
        hinzufügen / umbenennen / entfernen.
      </p>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.items}
          onClose={() => setMenu(null)}
        />
      )}
    </nav>
  );
}
