import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { findGamesWithoutImage, insertCover, type QuickImportRow } from "../quickImport";
import { Button } from "./ui/button";
import { CoverSearchDialog } from "./CoverSearchDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

// "Alle Konsolen" → "Cover suchen": walks every card that has no image yet,
// one cover-search dialog at a time. Picking a cover inserts it into that
// game's design (on disk) and jumps to the next card.
export function CoverSweepDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [phase, setPhase] = useState<"loading" | "run" | "done">("loading");
  const [queue, setQueue] = useState<QuickImportRow[]>([]);
  const [idx, setIdx] = useState(0);
  const [inserted, setInserted] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPhase("loading");
    setIdx(0);
    setInserted(0);
    setBusy(false);
    let cancelled = false;
    findGamesWithoutImage().then((rows) => {
      if (cancelled) return;
      setQueue(rows);
      setPhase(rows.length ? "run" : "done");
    });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const advance = () => {
    if (idx + 1 >= queue.length) setPhase("done");
    else setIdx(idx + 1);
  };

  const current = queue[idx];

  const onPick = async (url: string) => {
    if (!current || busy) return;
    setBusy(true);
    try {
      await insertCover(current, url);
      setInserted((n) => n + 1);
      advance();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (phase === "run" && current) {
    return (
      <CoverSearchDialog
        open={open}
        onOpenChange={onOpenChange}
        consoleName={current.consoleName}
        gameTitle={current.gameTitle}
        progress={{ index: idx, total: queue.length }}
        busy={busy}
        onPick={onPick}
        onSkip={advance}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Cover suchen – alle Karten</DialogTitle>
        </DialogHeader>
        {phase === "loading" ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Karten ohne Bild werden
            gesucht …
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-2">
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-emerald-500" />
              {inserted > 0
                ? `${inserted} Cover eingefügt.`
                : "Alle Karten haben bereits ein Bild."}
            </p>
            <Button onClick={() => onOpenChange(false)}>Schließen</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
