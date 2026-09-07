// Workspaces: independent libraries of consoles, cards and templates. A new
// one starts completely empty unless you ask for the example consoles.

import { del, keys } from "idb-keyval";
import { Check, Layers, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
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
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!open) return;
    setList(listWorkspaces());
    setName("");
    setSeeded(false);
  }, [open]);

  const create = () => {
    const ws = createWorkspace(name || t("New workspace"), seeded);
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
    const next = prompt(t("Workspace name"), ws.name);
    if (next === null) return;
    renameWorkspace(ws.id, next);
    setList(listWorkspaces());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-lg flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("Workspaces")}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          {t(
            "A workspace is its own library: its own consoles, cards, templates and guides. Nothing is shared between them, so a new one is a clean slate.",
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
                title={ws.id === active ? undefined : t("Switch to this workspace")}
              >
                {ws.name}
                {!ws.seeded && (
                  <span className="ml-1.5 text-[11px] text-muted-foreground">
                    {t("(empty start)")}
                  </span>
                )}
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
                    title={t("Delete workspace")}
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
            {t("New workspace")}
          </Label>
          <Input
            autoFocus
            value={name}
            placeholder={t("Name, e.g. “Mega Drive collection”")}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && create()}
          />
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={seeded} onCheckedChange={(v) => setSeeded(!!v)} />
            {t("Start with the example consoles")}
          </label>
          <p className="text-xs text-muted-foreground">
            {seeded
              ? t("Starts with the five built-in consoles and their games.")
              : t("Starts empty — no consoles, no cards. Add your own in the tree.")}
          </p>
          <Button size="sm" className="self-start" onClick={create}>
            <Plus /> {t("Create and switch")}
          </Button>
        </section>

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("Close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
