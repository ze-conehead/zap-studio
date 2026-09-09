import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  consolesWithoutLogo,
  insertConsoleLogo,
  type ConsoleRow,
} from "../consoleLogos";
import { useT } from "../i18n";
import { Button } from "./ui/button";
import { CoverSearchDialog } from "./CoverSearchDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

// "Find logos" from the global template: walks every console that has no
// logo yet, one SteamGridDB logo search at a time (pre-filled with the
// console name). Picking one drops it into that console's template as an
// image layer and jumps to the next console.
export function ConsoleLogoDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [phase, setPhase] = useState<"loading" | "run" | "done">("loading");
  const [queue, setQueue] = useState<ConsoleRow[]>([]);
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
    consolesWithoutLogo().then((rows) => {
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
      await insertConsoleLogo(current, url);
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
        gameTitle={current.consoleName}
        kind="logo"
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
          <DialogTitle>{t("Find logos – every console")}</DialogTitle>
        </DialogHeader>
        {phase === "loading" ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />{" "}
            {t("Looking for consoles without a logo …")}
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-2">
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-emerald-500" />
              {inserted > 0
                ? t("{n} console logo(s) inserted.", { n: inserted })
                : t("Every console already has a logo.")}
            </p>
            <Button onClick={() => onOpenChange(false)}>{t("Close")}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
