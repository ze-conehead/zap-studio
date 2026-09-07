import { CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  findGamesWithoutImage,
  findGamesWithoutLogo,
  insertCover,
  insertLogo,
  type QuickImportRow,
} from "../quickImport";
import { useT } from "../i18n";
import { Button } from "./ui/button";
import { CoverSearchDialog } from "./CoverSearchDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

// "Find cover" for many cards at once: walks every card that has no image
// yet, one search dialog at a time. Picking one inserts it into that game's
// design (on disk) and jumps to the next card. Scoped to one console with
// `consoleId`; `excludeGameKey` skips the open design.
//
// `kind: "logo"` runs the same sweep against SteamGridDB's logos, over the
// cards that have no logo layer yet.
export function CoverSweepDialog({
  open,
  onOpenChange,
  consoleId,
  consoleName,
  excludeGameKey,
  kind = "cover",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consoleId?: string;
  consoleName?: string;
  excludeGameKey?: string;
  kind?: "cover" | "logo";
}) {
  const t = useT();
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
    const find = kind === "logo" ? findGamesWithoutLogo : findGamesWithoutImage;
    find({ consoleId, excludeGameKey }).then((rows) => {
      if (cancelled) return;
      setQueue(rows);
      setPhase(rows.length ? "run" : "done");
    });
    return () => {
      cancelled = true;
    };
  }, [open, consoleId, excludeGameKey, kind]);

  const advance = () => {
    if (idx + 1 >= queue.length) setPhase("done");
    else setIdx(idx + 1);
  };

  const current = queue[idx];

  const onPick = async (url: string) => {
    if (!current || busy) return;
    setBusy(true);
    try {
      await (kind === "logo" ? insertLogo(current, url) : insertCover(current, url));
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
        kind={kind}
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
          <DialogTitle>
            {kind === "logo"
              ? consoleName
                ? t("Find logos – {name}", { name: consoleName })
                : t("Find logos – all cards")
              : consoleName
                ? t("Find covers – {name}", { name: consoleName })
                : t("Find covers – all cards")}
          </DialogTitle>
        </DialogHeader>
        {phase === "loading" ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />{" "}
            {kind === "logo"
              ? t("Looking for cards without a logo …")
              : t("Looking for cards without an image …")}
          </div>
        ) : (
          <div className="flex flex-col gap-3 py-2">
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-emerald-500" />
              {inserted > 0
                ? kind === "logo"
                  ? t("{n} logo(s) inserted.", { n: inserted })
                  : t("{n} cover(s) inserted.", { n: inserted })
                : kind === "logo"
                  ? t("Every card already has a logo.")
                  : t("Every card already has an image.")}
            </p>
            <Button onClick={() => onOpenChange(false)}>{t("Close")}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
