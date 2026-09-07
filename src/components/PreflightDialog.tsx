// Preflight: what would go wrong if this went to print right now. Checks the
// open card or the whole catalogue, and jumps to whatever it found.

import { AlertTriangle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useT } from "../i18n";
import {
  checkAllCards,
  checkCards,
  DPI_GOOD,
  PT_SMALL,
  SAFE_MM,
  type Finding,
} from "../preflight";
import { useStore } from "../store";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import type { Layer } from "../types";

type Scope = "card" | "all";

export function PreflightDialog({
  open,
  onOpenChange,
  overlay,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Template layers shown on the open card, so they get checked too. */
  overlay: Layer[];
  onPick: (consoleName: string, gameTitle: string, gameKey: string) => void;
}) {
  const t = useT();
  const { state } = useStore();
  const [scope, setScope] = useState<Scope>("card");
  const [findings, setFindings] = useState<Finding[] | null>(null);

  const run = useCallback(
    async (next: Scope) => {
      setFindings(null);
      if (next === "all") {
        setFindings(await checkAllCards());
      } else {
        setFindings(
          checkCards([
            {
              name: state.project.name,
              gameKey: state.project.gameKey,
              consoleName: state.project.consoleName,
              project: state.project,
              overlay,
            },
          ]),
        );
      }
    },
    [state.project, overlay],
  );

  useEffect(() => {
    if (!open) return;
    setScope("card");
    void run("card");
  }, [open, run]);

  const pick = (s: Scope) => {
    setScope(s);
    void run(s);
  };

  const errors = findings?.filter((f) => f.severity === "error").length ?? 0;
  const warnings = findings?.filter((f) => f.severity === "warning").length ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-2xl flex-col gap-3">
        <DialogHeader>
          <DialogTitle>{t("Preflight check")}</DialogTitle>
        </DialogHeader>

        <div className="flex gap-1 rounded-md border p-0.5 text-xs">
          {(["card", "all"] as Scope[]).map((s) => (
            <button
              key={s}
              className={cn(
                "flex-1 rounded px-2 py-1.5",
                scope === s
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent",
              )}
              onClick={() => pick(s)}
            >
              {s === "card" ? t("This card") : t("All cards")}
            </button>
          ))}
        </div>

        <p className="text-xs text-muted-foreground">
          {t(
            "Checks resolution ({dpi} dpi or better), text size (at least {pt} pt) and distance to the cut line ({safe} mm clear).",
            { dpi: DPI_GOOD, pt: PT_SMALL, safe: SAFE_MM },
          )}
        </p>

        {findings === null ? (
          <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {t("Checking …")}
          </div>
        ) : findings.length === 0 ? (
          <p className="flex items-center gap-2 py-8 text-sm">
            <CheckCircle2 className="size-4 text-emerald-500" />
            {t("Nothing to fix — ready to print.")}
          </p>
        ) : (
          <>
            <p className="text-xs">
              {errors > 0 && (
                <span className="text-destructive">
                  {t("{n} problem(s)", { n: errors })}
                </span>
              )}
              {errors > 0 && warnings > 0 && " · "}
              {warnings > 0 && (
                <span className="text-amber-400">
                  {t("{n} warning(s)", { n: warnings })}
                </span>
              )}
            </p>
            <ul className="min-h-0 flex-1 overflow-y-auto rounded-md border">
              {findings.map((f) => (
                <li
                  key={f.key}
                  className="flex gap-2.5 border-b p-2.5 text-sm last:border-b-0"
                >
                  {f.severity === "error" ? (
                    <XCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
                  ) : (
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      {f.layerName && (
                        <span className="font-medium">{f.layerName}</span>
                      )}
                      {f.fromTemplate && (
                        <span className="rounded bg-muted px-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                          {t("Template")}
                        </span>
                      )}
                    </div>
                    <p className="text-muted-foreground">{f.message}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {f.cards.length > 3
                        ? t("on {n} cards", { n: f.cards.length })
                        : f.cards.map((c) => c.name).join(", ")}
                    </p>
                  </div>
                  {f.cards[0]?.gameKey && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 shrink-0"
                      onClick={() => {
                        const c = f.cards[0];
                        onPick(c.consoleName ?? "", c.name, c.gameKey!);
                        onOpenChange(false);
                      }}
                    >
                      {t("Open")}
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("Close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
