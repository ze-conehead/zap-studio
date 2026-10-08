import { ChevronDown, ChevronRight, Columns3, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { getCatalog, getCatalogVersion, subscribeCatalog } from "../data/catalog";
import { findMeta, getGamelistVersion, loadGamelist, subscribeGamelists } from "../gamelist";
import { useT } from "../i18n";
import {
  addCustomColumn,
  allColumns,
  cellValue,
  getMetaColumnsVersion,
  hiddenColumns,
  removeCustomColumn,
  renameCustomColumn,
  setColumnHidden,
  subscribeMetaColumns,
  writeCell,
  type MetaColumn,
} from "../metaColumns";
import { getWorkspaceKind } from "../workspace";
import { cn } from "@/lib/utils";
import { askConfirm } from "./ConfirmDialog";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

// Settings ▸ Manage metadata: every game's gamelist entry in one table,
// grouped by console (each group folds away). Columns can be shown / hidden,
// and own columns added — their values print on a card as "{key}". Cells
// save when you leave them (Enter / Tab / click elsewhere); Escape undoes.

// With more games than this, the consoles start folded — a few thousand rows
// of inputs at once would make the dialog sluggish.
const OPEN_ALL_UP_TO = 300;

export function ManageMetadataDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  useSyncExternalStore(subscribeGamelists, getGamelistVersion, getGamelistVersion);
  useSyncExternalStore(subscribeCatalog, getCatalogVersion, getCatalogVersion);
  useSyncExternalStore(subscribeMetaColumns, getMetaColumnsVersion, getMetaColumnsVersion);

  const kind = getWorkspaceKind();
  const consoles = getCatalog();
  const columns = allColumns(kind);
  const hidden = hiddenColumns();
  const shown = columns.filter((c) => !hidden.has(c.key));
  const total = consoles.reduce((n, c) => n + c.games.length, 0);

  const [query, setQuery] = useState("");
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[88vh] max-w-[96vw] flex-col gap-3 sm:max-w-[96vw]"
        // Escape in a cell undoes that edit (see Cell) instead of closing.
        onEscapeKeyDown={(e) => {
          if (document.activeElement?.hasAttribute("data-meta-cell")) e.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("Manage metadata")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-64 max-w-full">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 pl-8"
              placeholder={t("Search games …")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setExpanded(new Set(consoles.map((c) => c.id)))}>
            {t("Expand all")}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExpanded(new Set())}>
            {t("Collapse all")}
          </Button>
          <div className="ml-auto" />
          <ColumnsMenu columns={columns} hidden={hidden} consoleIds={consoles.map((c) => c.id)} />
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-md border">
          <table className="w-max min-w-full border-separate border-spacing-0 text-sm">
            <thead className="sticky top-0 z-20 bg-background">
              <tr>
                <th className="sticky left-0 z-10 w-64 min-w-64 border-b border-r bg-background px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground">
                  {kind === "movies" ? t("Movie") : t("Game")}
                </th>
                {shown.map((c) => (
                  <th
                    key={c.key}
                    className={cn(
                      "border-b px-2 py-1.5 text-left text-xs font-semibold text-muted-foreground",
                      widthOf(c),
                    )}
                    title={c.custom ? t("Use it on a card as {token}", { token: `{${c.key}}` }) : undefined}
                  >
                    {c.label}
                    {c.custom && <span className="ml-1 font-normal opacity-60">{`{${c.key}}`}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            {consoles.map((c) => {
              const games = q ? c.games.filter((g) => g.title.toLowerCase().includes(q)) : c.games;
              if (q && games.length === 0) return null;
              const isOpen = !!q || expanded.has(c.id);
              return (
                <ConsoleGroup
                  key={c.id}
                  consoleId={c.id}
                  name={c.name}
                  titles={games.map((g) => g.title)}
                  open={isOpen}
                  onToggle={() => toggle(c.id)}
                  columns={shown}
                />
              );
            })}
          </table>
          {q && consoles.every((c) => !c.games.some((g) => g.title.toLowerCase().includes(q))) && (
            <p className="p-4 text-sm text-muted-foreground">{t("No game matches.")}</p>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("Changes save when you leave a cell (Enter, Tab or a click elsewhere); Escape undoes the edit.")}
        </p>
      </DialogContent>
    </Dialog>
  );
}

const widthOf = (c: MetaColumn) =>
  c.kind === "long" ? "min-w-80" : c.kind === "date" ? "min-w-36" : c.kind === "rating" ? "min-w-20" : "min-w-44";

function ConsoleGroup({
  consoleId,
  name,
  titles,
  open,
  onToggle,
  columns,
}: {
  consoleId: string;
  name: string;
  titles: string[];
  open: boolean;
  onToggle: () => void;
  columns: MetaColumn[];
}) {
  const t = useT();
  // Only an open group reads its gamelist.
  const games = open ? loadGamelist(consoleId) : [];
  return (
    <tbody>
      <tr>
        <td colSpan={columns.length + 1} className="border-b bg-muted/60 p-0">
          <button
            type="button"
            onClick={onToggle}
            className="sticky left-0 flex items-center gap-1.5 px-2 py-1.5 text-left text-sm font-semibold hover:text-primary"
          >
            {open ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            {name}
            <span className="font-normal text-muted-foreground">({titles.length})</span>
          </button>
        </td>
      </tr>
      {open &&
        titles.map((title) => {
          const meta = findMeta(games, title);
          return (
            <tr key={title} className="group">
              <td className="sticky left-0 z-10 w-64 min-w-64 max-w-64 truncate border-b border-r bg-background px-2 py-1 group-hover:bg-muted" title={title}>
                {title}
              </td>
              {columns.map((c) => (
                <td key={c.key} className="border-b p-0 group-hover:bg-muted/40">
                  <Cell
                    column={c}
                    value={cellValue(meta, c)}
                    label={t("{column} of {title}", { column: c.label, title })}
                    onCommit={(v) => writeCell(consoleId, title, c, v)}
                  />
                </td>
              ))}
            </tr>
          );
        })}
    </tbody>
  );
}

// One editable cell: keeps its own text while focused and writes it to the
// gamelist on blur / Enter — typing doesn't re-render the whole table.
function Cell({
  column,
  value,
  label,
  onCommit,
}: {
  column: MetaColumn;
  value: string;
  label: string;
  onCommit: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);
  const commit = () => {
    if (text !== value) onCommit(text);
  };
  return (
    <input
      aria-label={label}
      data-meta-cell=""
      title={column.kind === "long" && text ? text : undefined}
      type={column.kind === "date" ? "date" : "text"}
      inputMode={column.kind === "rating" ? "decimal" : undefined}
      placeholder={column.kind === "rating" ? "0–5" : undefined}
      className="h-8 w-full min-w-0 bg-transparent px-2 outline-none focus:bg-background focus:ring-1 focus:ring-inset focus:ring-ring"
      value={text}
      onFocus={() => (focused.current = true)}
      onBlur={() => {
        focused.current = false;
        commit();
      }}
      onChange={(e) => setText(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          // Undo this edit (the dialog stays open — see onEscapeKeyDown).
          const el = e.currentTarget;
          setText(value);
          requestAnimationFrame(() => el.blur());
        }
      }}
    />
  );
}

function ColumnsMenu({
  columns,
  hidden,
  consoleIds,
}: {
  columns: MetaColumn[];
  hidden: Set<string>;
  consoleIds: string[];
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [renaming, setRenaming] = useState<{ key: string; label: string } | null>(null);
  const shownCount = useMemo(() => columns.filter((c) => !hidden.has(c.key)).length, [columns, hidden]);

  const add = () => {
    if (addCustomColumn(name)) setName("");
  };
  const remove = async (c: MetaColumn) => {
    const ok = await askConfirm({
      title: t("Delete column “{name}”?", { name: c.label }),
      body: t("Its values are removed from every game. Cards using {token} show the token instead.", {
        token: `{${c.key}}`,
      }),
      confirmLabel: t("Delete"),
      destructive: true,
    });
    if (ok) removeCustomColumn(c.key, consoleIds);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Columns3 /> {t("Columns ({n}/{total})", { n: shownCount, total: columns.length })}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex max-h-[70vh] w-80 flex-col gap-2 overflow-auto p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("Shown columns")}</p>
        {columns.map((c) => (
          <div key={c.key} className="flex items-center gap-2 text-sm">
            {renaming?.key === c.key ? (
              <form
                className="flex flex-1 items-center gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  renameCustomColumn(c.key, renaming.label);
                  setRenaming(null);
                }}
              >
                <Input
                  autoFocus
                  className="h-7"
                  value={renaming.label}
                  onChange={(e) => setRenaming({ key: c.key, label: e.target.value })}
                  onBlur={() => setRenaming(null)}
                  onKeyDown={(e) => e.key === "Escape" && (e.stopPropagation(), setRenaming(null))}
                />
              </form>
            ) : (
              <label className="flex min-w-0 flex-1 items-center gap-2">
                <Checkbox checked={!hidden.has(c.key)} onCheckedChange={(v) => setColumnHidden(c.key, !v)} />
                <span className="truncate">{c.label}</span>
                {c.custom && <span className="shrink-0 text-xs text-muted-foreground">{`{${c.key}}`}</span>}
              </label>
            )}
            {c.custom && renaming?.key !== c.key && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  title={t("Rename")}
                  onClick={() => setRenaming({ key: c.key, label: c.label })}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-6 hover:text-destructive"
                  title={t("Delete column")}
                  onClick={() => void remove(c)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </>
            )}
          </div>
        ))}
        <form
          className="mt-1 flex items-center gap-1 border-t pt-2"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <Input
            className="h-8"
            placeholder={t("New column name")}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Button type="submit" size="sm" disabled={!name.trim()}>
            <Plus /> {t("Add")}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          {t("Type the key in braces next to an own column into any text layer to print its value on the card.")}
        </p>
      </PopoverContent>
    </Popover>
  );
}
