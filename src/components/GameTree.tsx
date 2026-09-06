import {
  Check,
  ChevronDown,
  ChevronRight,
  Gamepad2,
  Globe,
  ListFilter,
  Plus,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import {
  addGame,
  gameKeyOf,
  getCatalog,
  getCatalogVersion,
  isCustomConsole,
  removeConsole,
  removeGame,
  renameConsole,
  renameGame,
  subscribeCatalog,
} from "../data/catalog";
import { fitImageToMask, makeImageLayer } from "../factory";
import { renameGameMeta } from "../gamelist";
import { urlToLayerSource } from "../image";
import {
  insertCover,
  loadImagedGameKeys,
  type QuickImportRow,
} from "../quickImport";
import type { Layer } from "../types";
import { useT } from "../i18n";
import { useStore } from "../store";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { CoverSearchDialog } from "./CoverSearchDialog";
import { CoverSweepDialog } from "./CoverSweepDialog";
import { QuickImportDialog } from "./QuickImportDialog";

type TreeFilter = "all" | "with" | "without";

const FILTER_KEY = "stickerstudio:treeFilter";
const FILTER_LABEL: Record<TreeFilter, string> = {
  all: "All games",
  with: "With image only",
  without: "Without image only",
};

function loadTreeFilter(): TreeFilter {
  try {
    const v = localStorage.getItem(FILTER_KEY);
    return v === "with" || v === "without" ? v : "all";
  } catch {
    return "all";
  }
}

interface Props {
  activeGameKey?: string;
  activeConsoleId?: string;
  activeGlobal: boolean;
  mainMask?: Layer;
  onPickGame: (consoleName: string, gameTitle: string, gameKey: string) => void;
  onOpenConsole: (consoleId: string, consoleName: string) => void;
  onOpenGlobal: () => void;
}

type SweepScope = { consoleId?: string; consoleName?: string };

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

export function GameTree({
  activeGameKey,
  activeConsoleId,
  activeGlobal,
  mainMask,
  onPickGame,
  onOpenConsole,
  onOpenGlobal,
}: Props) {
  const t = useT();
  // Re-render when a game is added/removed elsewhere (right-click menu).
  const catalogVersion = useSyncExternalStore(
    subscribeCatalog,
    getCatalogVersion,
    getCatalogVersion,
  );
  const catalog = getCatalog();

  const { state, dispatch } = useStore();
  const currentGameKey = state.project.gameKey;
  const currentHasImage = state.project.layers.some((l) => l.type === "image");

  // Cover actions from the right-click menus.
  const [sweep, setSweep] = useState<SweepScope | null>(null);
  const [quick, setQuick] = useState<SweepScope | null>(null);
  const [gameCover, setGameCover] = useState<QuickImportRow | null>(null);

  // Add a cover to a single game: straight into the live editor when that
  // game's design is the one open, otherwise onto its design on disk.
  const insertCoverForGame = async (row: QuickImportRow, url: string) => {
    try {
      if (row.gameKey === currentGameKey) {
        const img = await urlToLayerSource(url);
        dispatch({
          type: "ADD_LAYER",
          layer: fitImageToMask(
            { ...makeImageLayer({ ...img, name: row.gameTitle }), main: true },
            mainMask,
          ),
        });
      } else {
        await insertCover(row, url);
      }
    } catch (e) {
      alert((e as Error).message);
    }
  };

  const promptCoverUrl = (row: QuickImportRow) => {
    const url = window.prompt(t("Image URL for the cover:"))?.trim();
    if (url) void insertCoverForGame(row, url);
  };

  const coverMenuItems = (row: QuickImportRow): ContextMenuItem[] => [
    { label: t("Find cover"), onSelect: () => setGameCover(row) },
    { label: t("Insert cover by URL"), onSelect: () => promptCoverUrl(row) },
  ];

  const sweepMenuItems = (scope: SweepScope): ContextMenuItem[] => [
    { label: t("Find cover"), onSelect: () => setSweep(scope) },
    { label: t("Insert cover by URL"), onSelect: () => setQuick(scope) },
  ];

  const activeConsole = activeConsoleId ?? activeGameKey?.split("/")[0];
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    activeConsole ? { [activeConsole]: true } : { [catalog[0]?.id ?? ""]: true },
  );
  const [menu, setMenu] = useState<MenuState | null>(null);

  const [filter, setFilter] = useState<TreeFilter>(loadTreeFilter);
  const [imaged, setImaged] = useState<Set<string>>(() => new Set());

  // Which games have an image — from IndexedDB, refreshed on navigation and
  // catalogue / current-image changes. The open design is overlaid live.
  useEffect(() => {
    let alive = true;
    loadImagedGameKeys().then((s) => {
      if (alive) setImaged(s);
    });
    return () => {
      alive = false;
    };
  }, [activeGameKey, activeConsoleId, catalogVersion, currentHasImage]);

  const changeFilter = (f: TreeFilter) => {
    setFilter(f);
    try {
      localStorage.setItem(FILTER_KEY, f);
    } catch {
      /* ignore */
    }
  };

  const gameHasImage = (gameKey: string) =>
    gameKey === currentGameKey ? currentHasImage : imaged.has(gameKey);

  const matchesFilter = (gameKey: string) =>
    filter === "all" ||
    (filter === "with" ? gameHasImage(gameKey) : !gameHasImage(gameKey));

  const countText = (shown: number, total: number) =>
    filter === "all" ? `(${total})` : `(${shown}/${total})`;

  const totalGames = catalog.reduce((n, c) => n + c.games.length, 0);
  const shownGames = catalog.reduce(
    (n, c) => n + c.games.filter((g) => matchesFilter(gameKeyOf(c, g))).length,
    0,
  );

  const expand = (consoleId: string) =>
    setOpen((o) => ({ ...o, [consoleId]: true }));

  const handleAddGame = (consoleId: string, consoleName: string) => {
    const title = window.prompt(t("New game for {name}:", { name: consoleName }))?.trim();
    if (!title) return;
    const game = addGame(consoleId, title);
    if (game) expand(consoleId);
  };

  const handleRemoveGame = (consoleId: string, game: { id: string; title: string }) => {
    if (
      window.confirm(
        t("Remove \u201c{title}\u201d from the list? An existing sticker design stays under \u201cProjects\u201d.", {
          title: game.title,
        }),
      )
    ) {
      removeGame(consoleId, game.id);
    }
  };

  const handleRenameGame = (consoleId: string, game: { id: string; title: string }) => {
    const next = window.prompt(t("Rename game:"), game.title)?.trim();
    if (!next || next === game.title) return;
    if (renameGame(consoleId, game.id, next)) {
      // keep the gamelist.xml entry (matched by title) attached
      renameGameMeta(consoleId, game.title, next);
    }
  };

  const handleRenameConsole = (consoleId: string, consoleName: string) => {
    const next = window.prompt(t("Rename console:"), consoleName)?.trim();
    if (!next || next === consoleName) return;
    renameConsole(consoleId, next);
  };

  const handleRemoveConsole = (consoleId: string, consoleName: string) => {
    if (
      window.confirm(
        t("Remove console \u201c{name}\u201d and all its games from the tree? Existing sticker designs stay under \u201cProjects\u201d.", {
          name: consoleName,
        }),
      )
    ) {
      removeConsole(consoleId);
    }
  };

  return (
    <nav className="flex w-64 shrink-0 flex-col border-r bg-sidebar">
      <h2 className="px-3 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("Consoles & games")}
      </h2>

      <div className="mx-2 mb-1 flex min-w-0 items-center gap-1">
        <button
          className={cn(
            "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold hover:bg-accent",
            activeGlobal && "bg-primary/15 ring-1 ring-primary",
          )}
          title={t("Global template – appears on every card")}
          onClick={onOpenGlobal}
          onContextMenu={(e) => {
            e.preventDefault();
            setMenu({ x: e.clientX, y: e.clientY, items: sweepMenuItems({}) });
          }}
        >
          <Globe className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-left">{t("All consoles")}</span>
          <span className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground">
            {countText(shownGames, totalGames)}
          </span>
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground",
                filter !== "all" && "text-primary",
              )}
              title={t("Filter games: {label}", { label: t(FILTER_LABEL[filter]) })}
            >
              <ListFilter className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("Show games")}</DropdownMenuLabel>
            {(Object.keys(FILTER_LABEL) as TreeFilter[]).map((f) => (
              <DropdownMenuItem key={f} onClick={() => changeFilter(f)}>
                <Check className={cn("size-4", filter !== f && "opacity-0")} />
                {t(FILTER_LABEL[f])}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ul className="px-2">
          {catalog.map((c) => {
            const expanded = !!open[c.id];
            const games = c.games
              .map((g, i) => ({ g, i }))
              .filter(({ g }) => matchesFilter(gameKeyOf(c, g)));
            return (
              <li key={c.id}>
                <Collapsible
                  open={expanded}
                  onOpenChange={(v) => setOpen((o) => ({ ...o, [c.id]: v }))}
                >
                  <div
                    className={cn(
                      "flex min-w-0 items-center gap-1 rounded-md",
                      activeConsoleId === c.id && "bg-primary/15 ring-1 ring-primary",
                    )}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setMenu({
                        x: e.clientX,
                        y: e.clientY,
                        items: [
                          {
                            label: t("Add"),
                            onSelect: () => handleAddGame(c.id, c.name),
                          },
                          {
                            label: t("Rename"),
                            onSelect: () => handleRenameConsole(c.id, c.name),
                          },
                          ...sweepMenuItems({ consoleId: c.id, consoleName: c.name }),
                          ...(isCustomConsole(c.id)
                            ? [
                                {
                                  label: t("Remove"),
                                  destructive: true,
                                  onSelect: () => handleRemoveConsole(c.id, c.name),
                                },
                              ]
                            : []),
                        ],
                      });
                    }}
                  >
                    <CollapsibleTrigger
                      className="rounded p-1 text-muted-foreground hover:text-foreground"
                      title={expanded ? t("Collapse") : t("Expand")}
                    >
                      {expanded ? (
                        <ChevronDown className="size-3.5" />
                      ) : (
                        <ChevronRight className="size-3.5" />
                      )}
                    </CollapsibleTrigger>
                    <button
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1.5 text-sm font-semibold hover:bg-accent"
                      title={t("{name} – edit shared template (right-click: add game / rename console)", { name: c.name })}
                      onClick={() => onOpenConsole(c.id, c.name)}
                    >
                      <Gamepad2 className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate text-left">{c.name}</span>
                      <span className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground">
                        {countText(games.length, c.games.length)}
                      </span>
                    </button>
                    <button
                      className="mr-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title={t("Add game")}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleAddGame(c.id, c.name);
                      }}
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>

                  <CollapsibleContent className="ml-3 border-l pl-1">
                    {filter !== "all" && games.length === 0 && (
                      <p className="px-1.5 py-1.5 text-[11px] text-muted-foreground">
                        {filter === "with"
                          ? t("No game with an image.")
                          : t("Every game has an image.")}
                      </p>
                    )}
                    {games.map(({ g, i }) => {
                      const key = gameKeyOf(c, g);
                      const active = key === activeGameKey;
                      return (
                        <button
                          key={g.id}
                          className={cn(
                            "flex w-full min-w-0 items-center gap-2 rounded-md px-1.5 py-1.5 text-left text-[13px] transition-colors",
                            active
                              ? "bg-primary font-semibold text-primary-foreground"
                              : "text-muted-foreground hover:bg-accent hover:text-foreground",
                          )}
                          title={t("{title} (right-click: rename / remove)", { title: g.title })}
                          onClick={() => onPickGame(c.name, g.title, key)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setMenu({
                              x: e.clientX,
                              y: e.clientY,
                              items: [
                                {
                                  label: t("Rename"),
                                  onSelect: () => handleRenameGame(c.id, g),
                                },
                                ...coverMenuItems({
                                  gameKey: key,
                                  consoleName: c.name,
                                  gameTitle: g.title,
                                }),
                                {
                                  label: t("Remove"),
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
                          <span className="min-w-0 flex-1 truncate">{g.title}</span>
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
        <strong className="text-foreground">{t("Console")}</strong>
        {t(" click: shared template. ")}
        <strong className="text-foreground">{t("Game")}</strong>
        {t(" click: its design. ")}
        <strong className="text-foreground">{t("Right-click")}</strong>
        {t(": add / rename / remove.")}
      </p>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menu.items}
          onClose={() => setMenu(null)}
        />
      )}

      {sweep && (
        <CoverSweepDialog
          open
          onOpenChange={(o) => !o && setSweep(null)}
          consoleId={sweep.consoleId}
          consoleName={sweep.consoleName}
          excludeGameKey={currentGameKey}
        />
      )}

      {quick && (
        <QuickImportDialog
          open
          onOpenChange={(o) => !o && setQuick(null)}
          consoleId={quick.consoleId}
          consoleName={quick.consoleName}
          currentGameKey={currentGameKey}
          onAddLayerToCurrent={(layer) => dispatch({ type: "ADD_LAYER", layer })}
        />
      )}

      {gameCover && (
        <CoverSearchDialog
          open
          onOpenChange={(o) => !o && setGameCover(null)}
          consoleName={gameCover.consoleName}
          gameTitle={gameCover.gameTitle}
          onPick={(url) => {
            setGameCover(null);
            void insertCoverForGame(gameCover, url);
          }}
        />
      )}
    </nav>
  );
}
