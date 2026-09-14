import {
  Check,
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Gamepad2,
  Globe,
  ListFilter,
  Plus,
  Search,
  X,
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
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { normalizeTitle } from "../covers";
import {
  addGame,
  gameKeyOf,
  addConsole,
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
import { getWorkspaceKind } from "../workspace";
import { askConfirm } from "./ConfirmDialog";
import { ContextMenu, type ContextMenuItem } from "./ContextMenu";
import { ConsoleLogoDialog } from "./ConsoleLogoDialog";
import { CoverSearchDialog } from "./CoverSearchDialog";
import { CoverSweepDialog } from "./CoverSweepDialog";
import { PromptDialog, type PromptState } from "./PromptDialog";
import { QuickImportDialog } from "./QuickImportDialog";

type TreeFilter = "all" | "with" | "without";

const FILTER_KEY = "stickerstudio:treeFilter";
const FILTER_LABEL: Record<TreeFilter, string> = {
  all: "All games",
  with: "With image only",
  without: "Without image only",
};
const FILTER_LABEL_MOVIES: Record<TreeFilter, string> = {
  all: "All movies",
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
  masks?: Layer[];
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
  masks = [],
  onPickGame,
  onOpenConsole,
  onOpenGlobal,
}: Props) {
  const t = useT();
  const isMovies = getWorkspaceKind() === "movies";
  const filterLabel = isMovies ? FILTER_LABEL_MOVIES : FILTER_LABEL;
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
  const [consoleLogos, setConsoleLogos] = useState(false);
  const [gameCover, setGameCover] = useState<QuickImportRow | null>(null);
  const [prompt, setPrompt] = useState<PromptState | null>(null);

  // Add a cover to a single game: straight into the live editor when that
  // game's design is the one open, otherwise onto its design on disk.
  const insertCoverForGame = async (row: QuickImportRow, url: string) => {
    try {
      if (row.gameKey === currentGameKey) {
        const img = await urlToLayerSource(url);
        dispatch({
          type: "ADD_LAYER",
          layer: fitImageToMask(
            {
              ...makeImageLayer({ ...img, name: t("Main image") }),
              maskId: masks[0]?.id,
            },
            masks[0],
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
    setPrompt({
      title: t("Image URL for the cover:"),
      onSubmit: (url) => void insertCoverForGame(row, url),
    });
  };

  const coverMenuItems = (row: QuickImportRow): ContextMenuItem[] => [
    { label: t("Find cover"), onSelect: () => setGameCover(row) },
    { label: t("Insert cover by URL"), onSelect: () => promptCoverUrl(row) },
  ];

  const addConsolePrompt = () => {
    setPrompt({
      title: isMovies ? t("Collection name:") : t("Console name:"),
      onSubmit: (name) => {
        if (!addConsole(name)) {
          alert(
            isMovies
              ? t("That collection already exists.")
              : t("That console already exists."),
          );
        }
      },
    });
  };

  // Per-console / per-game sweep: covers only. Logos are a global-template
  // job now — one per console, see the global context menu below.
  const sweepMenuItems = (scope: SweepScope): ContextMenuItem[] => [
    { label: t("Find cover"), onSelect: () => setSweep(scope) },
    { label: t("Insert cover by URL"), onSelect: () => setQuick(scope) },
  ];

  const globalMenuItems = (): ContextMenuItem[] => [
    { label: t("Find cover"), onSelect: () => setSweep({}) },
    { label: t("Find logos"), onSelect: () => setConsoleLogos(true) },
    { label: t("Insert cover by URL"), onSelect: () => setQuick({}) },
  ];

  const activeConsole = activeConsoleId ?? activeGameKey?.split("/")[0];
  const [open, setOpen] = useState<Record<string, boolean>>(() =>
    activeConsole ? { [activeConsole]: true } : { [catalog[0]?.id ?? ""]: true },
  );
  const [menu, setMenu] = useState<MenuState | null>(null);

  const [filter, setFilter] = useState<TreeFilter>(loadTreeFilter);
  const [imaged, setImaged] = useState<Set<string>>(() => new Set());
  // Title search: a console whose own name matches shows all its games;
  // otherwise only the games that match. Consoles with nothing left are
  // hidden, and everything still shown is expanded.
  const [query, setQuery] = useState("");
  const q = normalizeTitle(query);

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
    filter === "all" && !q ? `(${total})` : `(${shown}/${total})`;

  const consoleHit = (c: { name: string }) => !!q && normalizeTitle(c.name).includes(q);
  const visibleGames = (c: (typeof catalog)[number]) =>
    c.games
      .map((g, i) => ({ g, i }))
      .filter(({ g }) => matchesFilter(gameKeyOf(c, g)))
      .filter(({ g }) => !q || consoleHit(c) || normalizeTitle(g.title).includes(q));

  const totalGames = catalog.reduce((n, c) => n + c.games.length, 0);
  const shownGames = catalog.reduce((n, c) => n + visibleGames(c).length, 0);

  const expand = (consoleId: string) =>
    setOpen((o) => ({ ...o, [consoleId]: true }));

  const handleAddGame = (consoleId: string, consoleName: string) => {
    setPrompt({
      title: isMovies
        ? t("New movie for {name}:", { name: consoleName })
        : t("New game for {name}:", { name: consoleName }),
      onSubmit: (title) => {
        const game = addGame(consoleId, title);
        if (game) expand(consoleId);
      },
    });
  };

  const handleRemoveGame = async (consoleId: string, game: { id: string; title: string }) => {
    const ok = await askConfirm({
      title: t("Remove \u201c{title}\u201d from the list?", { title: game.title }),
      body: t("An existing sticker design stays under \u201cProjects\u201d."),
      confirmLabel: t("Remove"),
      destructive: true,
    });
    if (ok) removeGame(consoleId, game.id);
  };

  const handleRenameGame = (consoleId: string, game: { id: string; title: string }) => {
    setPrompt({
      title: isMovies ? t("Rename movie:") : t("Rename game:"),
      defaultValue: game.title,
      onSubmit: (next) => {
        if (next === game.title) return;
        if (renameGame(consoleId, game.id, next)) {
          // keep the gamelist.xml entry (matched by title) attached
          renameGameMeta(consoleId, game.title, next);
        }
      },
    });
  };

  const handleRenameConsole = (consoleId: string, consoleName: string) => {
    setPrompt({
      title: isMovies ? t("Rename collection:") : t("Rename console:"),
      defaultValue: consoleName,
      onSubmit: (next) => {
        if (next === consoleName) return;
        renameConsole(consoleId, next);
      },
    });
  };

  const handleRemoveConsole = async (consoleId: string, consoleName: string) => {
    const ok = await askConfirm({
      title: isMovies
        ? t("Remove collection \u201c{name}\u201d and all its movies from the tree?", { name: consoleName })
        : t("Remove console \u201c{name}\u201d and all its games from the tree?", { name: consoleName }),
      body: t("Existing sticker designs stay under \u201cProjects\u201d."),
      confirmLabel: t("Remove"),
      destructive: true,
    });
    if (ok) removeConsole(consoleId);
  };

  return (
    <nav className="flex w-64 shrink-0 flex-col border-r bg-sidebar">
      <h2 className="px-3 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {isMovies ? t("Collections & movies") : t("Consoles & games")}
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
            setMenu({ x: e.clientX, y: e.clientY, items: globalMenuItems() });
          }}
        >
          <Globe className="size-4 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate text-left">
            {isMovies ? t("All collections") : t("All consoles")}
          </span>
          <span className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground">
            {countText(shownGames, totalGames)}
          </span>
        </button>
        <button
          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          title={isMovies ? t("Add collection") : t("Add console")}
          onClick={addConsolePrompt}
        >
          <Plus className="size-4" />
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground",
                filter !== "all" && "text-primary",
              )}
              title={t("Filter games: {label}", { label: t(filterLabel[filter]) })}
            >
              <ListFilter className="size-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{isMovies ? t("Show movies") : t("Show games")}</DropdownMenuLabel>
            {(Object.keys(filterLabel) as TreeFilter[]).map((f) => (
              <DropdownMenuItem key={f} onClick={() => changeFilter(f)}>
                <Check className={cn("size-4", filter !== f && "opacity-0")} />
                {t(filterLabel[f])}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="relative mx-2 mb-1">
        <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Escape" && setQuery("")}
          placeholder={t("Search …")}
          className="h-7 pl-7 pr-7 text-xs"
        />
        {query && (
          <button
            className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
            title={t("Clear")}
            onClick={() => setQuery("")}
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <ul className="px-2">
          {catalog.map((c) => {
            const games = visibleGames(c);
            if (q && !consoleHit(c) && games.length === 0) return null;
            const expanded = q ? true : !!open[c.id];
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
                      title={
                        isMovies
                          ? t("{name} – edit shared template (right-click: add movie / rename collection)", { name: c.name })
                          : t("{name} – edit shared template (right-click: add game / rename console)", { name: c.name })
                      }
                      onClick={() => onOpenConsole(c.id, c.name)}
                    >
                      {isMovies ? (
                        <Clapperboard className="size-4 shrink-0 text-muted-foreground" />
                      ) : (
                        <Gamepad2 className="size-4 shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1 truncate text-left">{c.name}</span>
                      <span className="shrink-0 text-xs font-normal tabular-nums text-muted-foreground">
                        {countText(games.length, c.games.length)}
                      </span>
                    </button>
                    <button
                      className="mr-1 shrink-0 rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                      title={isMovies ? t("Add movie") : t("Add game")}
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

      {consoleLogos && (
        <ConsoleLogoDialog
          open
          onOpenChange={(o) => !o && setConsoleLogos(false)}
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

      <PromptDialog state={prompt} onOpenChange={(o) => !o && setPrompt(null)} />
    </nav>
  );
}
