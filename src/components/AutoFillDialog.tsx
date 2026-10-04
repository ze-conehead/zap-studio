import { CheckCircle2, Loader2, Wand2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  planAutoFill,
  runAutoFill,
  type AutoFillOptions,
  type AutoFillPlan,
  type AutoFillProgress,
  type AutoFillReport,
} from "../autoFill";
import { useT } from "../i18n";
import { loadProject, saveProject } from "../persist";
import { useStore } from "../store";
import { getWorkspaceKind } from "../workspace";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

// Fully automatic Find logos / Find cover / screenshots: no search dialog,
// no picking. Logos first (one per console that has none), then the empty
// screenshot frames of every card — each filled with a different picture.
// Uses the sources chosen in Settings. Scoped to one console with
// `consoleId`.
export function AutoFillDialog({
  open,
  onOpenChange,
  consoleId,
  consoleName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consoleId?: string;
  consoleName?: string;
}) {
  const t = useT();
  const { state, dispatch } = useStore();
  const [phase, setPhase] = useState<"loading" | "setup" | "run" | "done">("loading");
  const [plan, setPlan] = useState<AutoFillPlan | null>(null);
  const [opts, setOpts] = useState<AutoFillOptions>({ logos: true, covers: false, screenshots: true });
  const [progress, setProgress] = useState<AutoFillProgress | null>(null);
  const [report, setReport] = useState<AutoFillReport | null>(null);
  const abort = useRef<AbortController | null>(null);
  const movies = getWorkspaceKind() === "movies";

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setPhase("loading");
    setReport(null);
    setProgress(null);
    (async () => {
      // The plan reads from disk, so flush the open design first.
      if (state.dirty) await saveProject(state.project);
      const p = await planAutoFill(consoleId);
      if (!alive) return;
      setPlan(p);
      setOpts({ logos: !movies && p.logos.length > 0, covers: false, screenshots: p.screenshots.length > 0 });
      setPhase("setup");
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, consoleId]);

  // Stop a running fill when the dialog goes away.
  useEffect(() => () => abort.current?.abort(), []);

  const start = async () => {
    if (!plan) return;
    const ctl = new AbortController();
    abort.current = ctl;
    setPhase("run");
    const openId = state.project.id;
    const before = state.project.updatedAt;
    const r = await runAutoFill(plan, opts, setProgress, ctl.signal);
    setReport(r);
    // Pick up what was written to the design that's open in the editor.
    const fresh = await loadProject(openId);
    if (fresh && fresh.updatedAt !== before) dispatch({ type: "LOAD", project: fresh });
    setPhase("done");
  };

  const counts = plan
    ? {
        logos: plan.logos.length,
        covers: plan.covers.length,
        screenshots: plan.screenshots.reduce((n, x) => n + x.masks.length, 0),
      }
    : { logos: 0, covers: 0, screenshots: 0 };
  const anything =
    (opts.logos && counts.logos > 0) ||
    (opts.covers && counts.covers > 0) ||
    (opts.screenshots && counts.screenshots > 0);

  const phaseName = (p: AutoFillProgress["phase"]) =>
    p === "logos" ? t("Logos") : p === "covers" ? t("Covers") : t("Screenshots");

  const row = (key: keyof AutoFillOptions, label: string, detail: string, disabled = false) => (
    <label className="flex items-start gap-2 text-sm">
      <Checkbox
        className="mt-0.5"
        disabled={disabled}
        checked={opts[key] && !disabled}
        onCheckedChange={(v) => setOpts((o) => ({ ...o, [key]: !!v }))}
      />
      <span>
        {label}
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </label>
  );

  return (
    <Dialog open={open} onOpenChange={(o) => (phase === "run" ? undefined : onOpenChange(o))}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="size-4" />
            {consoleName
              ? t("Auto-fill – {name}", { name: consoleName })
              : t("Auto-fill – everything")}
          </DialogTitle>
        </DialogHeader>

        {phase === "loading" && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {t("Checking what is missing …")}
          </div>
        )}

        {phase === "setup" && plan && (
          <div className="flex flex-col gap-3 py-1">
            <p className="text-xs text-muted-foreground">
              {t(
                "Fills in everything that is still empty, without asking: the first logo found for each console, then a different picture for every empty screenshot frame. Uses the sources from Settings.",
              )}
            </p>
            {row(
              "logos",
              t("Logos"),
              movies
                ? t("Not available for movies.")
                : t("{n} console(s) without a logo", { n: counts.logos }),
              movies || counts.logos === 0,
            )}
            {row(
              "screenshots",
              t("Screenshots"),
              counts.screenshots > 0
                ? t("{n} empty frame(s) in {cards} card(s)", {
                    n: counts.screenshots,
                    cards: plan.screenshots.length,
                  })
                : t("No empty screenshot frames — add alpha masks to a template first."),
              counts.screenshots === 0,
            )}
            {row(
              "covers",
              t("Covers"),
              counts.covers > 0
                ? t("{n} card(s) without a cover", { n: counts.covers })
                : t("No cover frame, or every card already has one."),
              counts.covers === 0,
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                {t("Cancel")}
              </Button>
              <Button disabled={!anything} onClick={() => void start()}>
                <Wand2 /> {t("Start")}
              </Button>
            </div>
          </div>
        )}

        {phase === "run" && (
          <div className="flex flex-col gap-3 py-2">
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="size-4 shrink-0 animate-spin" />
              <span className="truncate">
                {progress ? `${phaseName(progress.phase)} – ${progress.label}` : t("Starting …")}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-muted">
              <div
                className="h-full bg-primary transition-all"
                style={{
                  width: progress ? `${(progress.done / Math.max(1, progress.total)) * 100}%` : "0%",
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="tabular-nums">
                {progress ? `${progress.done} / ${progress.total}` : ""}
              </span>
              <Button variant="outline" size="sm" onClick={() => abort.current?.abort()}>
                {t("Stop")}
              </Button>
            </div>
          </div>
        )}

        {phase === "done" && report && (
          <div className="flex flex-col gap-3 py-2">
            <p className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="size-4 text-emerald-500" />
              {abort.current?.signal.aborted ? t("Stopped.") : t("Done.")}
            </p>
            <ul className="text-sm">
              {opts.logos && <li>{t("{n} logo(s) inserted", { n: report.logos })}</li>}
              {opts.covers && <li>{t("{n} cover(s) inserted", { n: report.covers })}</li>}
              {opts.screenshots && <li>{t("{n} screenshot(s) inserted", { n: report.screenshots })}</li>}
              {report.missing > 0 && (
                <li className="text-muted-foreground">
                  {t("{n} item(s) had no usable picture", { n: report.missing })}
                </li>
              )}
              {report.failed > 0 && (
                <li className="text-destructive">
                  {t("{n} step(s) failed: {msg}", { n: report.failed, msg: report.firstError ?? "" })}
                </li>
              )}
            </ul>
            <Button onClick={() => onOpenChange(false)}>{t("Close")}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
