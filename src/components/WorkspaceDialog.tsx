// Projects: independent libraries of consoles, cards and templates. A new one
// starts completely empty unless you ask for the example consoles.
//
// Called "workspace" throughout the source because `Project` is already the
// type of a single card design — only the labels say "project".

import { del, keys } from "idb-keyval";
import { Check, Layers, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { seedWorkspace } from "../data/catalog";
import {
  EXAMPLE_CONSOLES,
  EXAMPLE_GAMES_DEFAULT,
  EXAMPLE_GAMES_MAX,
  EXAMPLE_GAMES_MIN,
} from "../data/baseGameList";
import { FORMAT_IDS, FORMATS, getFormatId, type FormatId } from "../formats";
import { useT } from "../i18n";
import {
  createWorkspace,
  DEFAULT_WS,
  deleteWorkspace,
  getWorkspaceId,
  listWorkspaces,
  renameWorkspace,
  switchWorkspace,
  type Workspace,
} from "../workspace";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Slider } from "./ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export function WorkspaceDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const active = getWorkspaceId();
  const [list, setList] = useState<Workspace[]>([]);
  const [name, setName] = useState("");
  const [example, setExample] = useState(false);
  const [games, setGames] = useState(EXAMPLE_GAMES_DEFAULT);
  const [format, setFormat] = useState<FormatId>(getFormatId());

  useEffect(() => {
    if (!open) return;
    setList(listWorkspaces());
    setName("");
    setExample(false);
    setGames(EXAMPLE_GAMES_DEFAULT);
    setFormat(getFormatId());
  }, [open]);

  const create = () => {
    const ws = createWorkspace(name || t("New project"), {
      seeded: example,
      format,
    });
    if (example) seedWorkspace(ws.id, games);
    switchWorkspace(ws.id); // reloads
  };

  const remove = async (ws: Workspace) => {
    if (
      !confirm(
        t(
          "Delete “{name}” with all its consoles, cards and templates? This cannot be undone.",
          { name: ws.name },
        ),
      )
    ) {
      return;
    }
    await deleteWorkspace(ws.id, { keys, del });
    if (ws.id === active) location.reload();
    else setList(listWorkspaces());
  };

  const rename = (ws: Workspace) => {
    const next = prompt(t("Project name"), ws.name);
    if (next === null) return;
    renameWorkspace(ws.id, next);
    setList(listWorkspaces());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-lg flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("Projects")}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          {t(
            "A project is its own library: its own consoles, cards, templates and guides. Nothing is shared between them, so a new one is a clean slate.",
          )}
        </p>

        <ul className="rounded-md border">
          {list.map((ws) => (
            <li
              key={ws.id || "default"}
              className="flex items-center gap-2 border-b px-2.5 py-2 text-sm last:border-b-0"
            >
              <Check
                className={cn("size-4 shrink-0", ws.id !== active && "opacity-0")}
              />
              <button
                className="flex-1 truncate text-left hover:underline disabled:no-underline"
                disabled={ws.id === active}
                onClick={() => switchWorkspace(ws.id)}
                title={ws.id === active ? undefined : t("Switch to this project")}
              >
                {ws.name}
                <span className="ml-1.5 text-[11px] text-muted-foreground">
                  {ws.format && FORMATS[ws.format as FormatId]
                    ? t(FORMATS[ws.format as FormatId].name)
                    : ""}
                  {!ws.seeded && ` ${t("(empty start)")}`}
                </span>
              </button>
              {ws.id !== DEFAULT_WS && (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    onClick={() => rename(ws)}
                  >
                    {t("Rename")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7"
                    title={t("Delete project")}
                    onClick={() => void remove(ws)}
                  >
                    <Trash2 />
                  </Button>
                </>
              )}
            </li>
          ))}
        </ul>

        <section className="flex flex-col gap-2.5 rounded-md border p-3">
          <Label>
            <Layers className="mr-1 inline size-4" />
            {t("New project")}
          </Label>
          <Input
            autoFocus
            value={name}
            placeholder={t("Name, e.g. “Mega Drive collection”")}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-sm text-muted-foreground">
              {t("Format")}
            </span>
            <Select value={format} onValueChange={(v) => setFormat(v as FormatId)}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FORMAT_IDS.map((id) => (
                  <SelectItem key={id} value={id}>
                    {t(FORMATS[id].name)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={example} onCheckedChange={(v) => setExample(!!v)} />
            {t("Example consoles")}
          </label>

          {example ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t("Games per console")}</span>
                <span className="tabular-nums text-foreground">{games}</span>
              </div>
              <Slider
                min={EXAMPLE_GAMES_MIN}
                max={EXAMPLE_GAMES_MAX}
                step={1}
                value={[games]}
                onValueChange={([v]) => setGames(v)}
              />
              <p className="text-xs text-muted-foreground">
                {t("{consoles} — top {n} games each, with metadata from base_game_list.csv.", {
                  consoles: EXAMPLE_CONSOLES.join(", "),
                  n: games,
                })}
              </p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">
              {t("Starts empty — no consoles, no cards. Add your own in the tree.")}
            </p>
          )}
        </section>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("Close")}
          </Button>
          <Button size="sm" onClick={create}>
            {t("Create")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
