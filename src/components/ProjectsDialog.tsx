import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getLang, useT } from "../i18n";
import { askConfirm } from "./ConfirmDialog";
import { unlinkProject } from "../gameIndex";
import { deleteProject, listProjects, loadProject } from "../persist";
import type { ProjectMeta } from "../types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentId: string;
  onOpen: (id: string) => void;
}

export function ProjectsDialog({ open, onOpenChange, currentId, onOpen }: Props) {
  const t = useT();
  const [items, setItems] = useState<ProjectMeta[]>([]);

  const refresh = () => listProjects().then(setItems);
  useEffect(() => {
    if (open) refresh();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("Your designs")}</DialogTitle>
        </DialogHeader>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("No saved designs yet.")}
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto pr-3">
            <ul className="flex flex-col gap-1.5">
              {items.map((p) => (
                <li key={p.id} className="flex items-stretch gap-1.5">
                  <button
                    className="flex flex-1 flex-col items-start rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent aria-[current=true]:border-primary"
                    aria-current={p.id === currentId}
                    onClick={async () => {
                      const full = await loadProject(p.id);
                      if (full) onOpen(p.id);
                    }}
                  >
                    <span className="font-medium">
                      {p.name}
                      {p.id === currentId && (
                        <span className="text-muted-foreground">{t(" · open")}</span>
                      )}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(p.updatedAt).toLocaleString(getLang() === "de" ? "de-DE" : "en-US")}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={p.id === currentId}
                    title={t("Delete")}
                    onClick={async () => {
                      const ok = await askConfirm({
                        title: t("Really delete \u201c{name}\u201d?", { name: p.name }),
                        confirmLabel: t("Delete"),
                        destructive: true,
                      });
                      if (ok) {
                        await deleteProject(p.id);
                        unlinkProject(p.id);
                        refresh();
                      }
                    }}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
