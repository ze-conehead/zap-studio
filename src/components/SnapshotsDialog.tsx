import { Camera, History, Loader2, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useLang, useT } from "../i18n";
import { deleteSnapshot, listSnapshots, saveSnapshot, type Snapshot } from "../snapshots";
import { useStore } from "../store";
import { askConfirm } from "./ConfirmDialog";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";

// Named versions of the open design / template (src/snapshots.ts): take one
// now, or put an earlier one back. Restoring is a normal edit, so ⌘Z undoes
// it.
export function SnapshotsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [lang] = useLang();
  const { state, dispatch } = useStore();
  const { project } = state;
  const [list, setList] = useState<Snapshot[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const reload = () => listSnapshots(project.id).then(setList);

  useEffect(() => {
    if (!open) return;
    setList(null);
    setName("");
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, project.id]);

  const take = async () => {
    setBusy(true);
    try {
      await saveSnapshot(state.project, name);
      setName("");
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const restore = async (s: Snapshot) => {
    const ok = await askConfirm({
      title: t("Restore “{name}”?", { name: s.name }),
      body: t("The design goes back to this snapshot. You can undo it with ⌘Z."),
      confirmLabel: t("Restore"),
    });
    if (!ok) return;
    dispatch({ type: "RESTORE", project: s.project });
    onOpenChange(false);
  };

  const remove = async (s: Snapshot) => {
    await deleteSnapshot(s);
    await reload();
  };

  const when = (ms: number) =>
    new Date(ms).toLocaleString(lang === "de" ? "de-DE" : undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-md flex-col gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="size-4" /> {t("Snapshots – {name}", { name: project.name })}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1.5">
          <Input
            autoFocus
            value={name}
            placeholder={t("Name, e.g. “before the redesign”")}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void take()}
          />
          <Button disabled={busy} onClick={() => void take()}>
            {busy ? <Loader2 className="animate-spin" /> : <Camera />} {t("Save")}
          </Button>
        </div>

        <div className="-mx-1 flex min-h-0 flex-col gap-1 overflow-y-auto px-1">
          {list === null ? (
            <Loader2 className="mx-auto my-4 size-4 animate-spin text-muted-foreground" />
          ) : list.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">
              {t("No snapshots of this design yet.")}
            </p>
          ) : (
            list.map((s) => (
              <div key={s.id} className="flex items-center gap-2 rounded-md border px-2.5 py-1.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm">
                    {s.name}
                    {s.auto && (
                      <span className="ml-1.5 rounded bg-muted px-1 py-px text-[10px] text-muted-foreground">
                        {t("automatic")}
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {when(s.createdAt)} · {t("{n} layer(s)", { n: s.project.layers.length })}
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => void restore(s)}>
                  {t("Restore")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  title={t("Delete")}
                  onClick={() => void remove(s)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
