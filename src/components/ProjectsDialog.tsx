import { Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const [items, setItems] = useState<ProjectMeta[]>([]);

  const refresh = () => listProjects().then(setItems);
  useEffect(() => {
    if (open) refresh();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Deine Designs</DialogTitle>
        </DialogHeader>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine gespeicherten Designs.
          </p>
        ) : (
          <ScrollArea className="max-h-[60vh] pr-3">
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
                        <span className="text-muted-foreground"> · geöffnet</span>
                      )}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(p.updatedAt).toLocaleString("de-DE")}
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={p.id === currentId}
                    title="Löschen"
                    onClick={async () => {
                      if (confirm(`„${p.name}" wirklich löschen?`)) {
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
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
