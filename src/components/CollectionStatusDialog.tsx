import { AlertTriangle, Check, ListChecks, Loader2, Minus, Wand2, Database } from "lucide-react";
import { useEffect, useState } from "react";
import { hasGaps, loadCollectionStatus, type ConsoleStatus, type GameStatus } from "../collection";
import { useT } from "../i18n";
import { saveProject } from "../persist";
import { useStore } from "../store";
import { cn } from "@/lib/utils";
import { AutoFillDialog } from "./AutoFillDialog";
import { MetaSweepDialog } from "./MetaSweepDialog";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

// What every card is still missing, console by console (src/collection.ts)
// — with the tools that fill those gaps one click away: Auto-fill and the
// metadata fetch per console, and a click on a card opens it.
export function CollectionStatusDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (consoleName: string, gameTitle: string, gameKey: string) => void;
}) {
  const t = useT();
  const { state } = useStore();
  const [data, setData] = useState<ConsoleStatus[] | null>(null);
  const [gapsOnly, setGapsOnly] = useState(true);
  const [autoFill, setAutoFill] = useState<ConsoleStatus | null>(null);
  const [metaSweep, setMetaSweep] = useState<ConsoleStatus | null>(null);

  const reload = async () => {
    setData(null);
    if (state.dirty) await saveProject(state.project);
    setData(await loadCollectionStatus());
  };

  useEffect(() => {
    if (open) void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const all = data?.flatMap((c) => c.games) ?? [];
  const sum = {
    cards: all.length,
    noDesign: all.filter((g) => !g.hasDesign).length,
    frames: all.reduce((n, g) => n + (g.framesTotal - g.framesFilled), 0),
    noMeta: all.filter((g) => !g.hasMeta).length,
    errors: all.filter((g) => g.errors > 0).length,
    dupes: all.filter((g) => g.sharesPictureWith.length > 0).length,
    done: all.filter((g) => !hasGaps(g)).length,
  };

  return (
    <>
      <Dialog open={open && !autoFill && !metaSweep} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[88vh] max-w-4xl flex-col gap-3">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ListChecks className="size-4" /> {t("Collection status")}
            </DialogTitle>
          </DialogHeader>

          {!data ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {t("Checking every card …")}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span>
                  <strong className="text-sm">{sum.done}</strong> / {sum.cards} {t("cards complete")}
                </span>
                <Stat n={sum.noDesign} label={t("without a design")} />
                <Stat n={sum.frames} label={t("empty frames")} />
                <Stat n={sum.noMeta} label={t("without metadata")} />
                <Stat n={sum.errors} label={t("with print errors")} tone="bad" />
                <Stat n={sum.dupes} label={t("sharing a picture")} />
                <label className="ml-auto flex items-center gap-1.5 text-sm">
                  <Checkbox checked={gapsOnly} onCheckedChange={(v) => setGapsOnly(!!v)} />
                  {t("Only cards with gaps")}
                </label>
              </div>

              <div className="-mx-1 flex min-h-0 flex-col gap-3 overflow-y-auto px-1 pb-1">
                {data.map((c) => {
                  const rows = gapsOnly ? c.games.filter(hasGaps) : c.games;
                  const logoMissing = c.logoSlot && !c.hasLogo;
                  if (gapsOnly && !rows.length && !logoMissing) return null;
                  return (
                    <section key={c.consoleId} className="rounded-md border">
                      <header className="flex flex-wrap items-center gap-2 border-b bg-muted/40 px-2.5 py-1.5">
                        <span className="text-sm font-medium">{c.consoleName}</span>
                        <span className="text-xs text-muted-foreground">
                          {t("{n} / {total} complete", {
                            n: c.games.filter((g) => !hasGaps(g)).length,
                            total: c.games.length,
                          })}
                        </span>
                        {logoMissing && (
                          <span className="rounded bg-amber-500/15 px-1.5 text-[11px] text-amber-500">
                            {t("no logo")}
                          </span>
                        )}
                        <span className="ml-auto flex gap-1">
                          <Button variant="outline" size="sm" className="h-7" onClick={() => setMetaSweep(c)}>
                            <Database /> {t("Fetch metadata …")}
                          </Button>
                          <Button variant="outline" size="sm" className="h-7" onClick={() => setAutoFill(c)}>
                            <Wand2 /> {t("Auto-fill …")}
                          </Button>
                        </span>
                      </header>
                      {rows.length === 0 ? (
                        <p className="px-2.5 py-2 text-xs text-muted-foreground">{t("Every card is complete.")}</p>
                      ) : (
                        <table className="w-full table-fixed text-xs">
                          <colgroup>
                            <col />
                            <col className="w-16" />
                            <col className="w-20" />
                            <col className="w-20" />
                            <col className="w-28" />
                            <col className="w-56" />
                          </colgroup>
                          <thead className="text-muted-foreground">
                            <tr className="[&>th]:px-2.5 [&>th]:py-1 [&>th]:text-left [&>th]:font-normal">
                              <th>{t("Card")}</th>
                              <th>{t("Design")}</th>
                              <th>{t("Frames")}</th>
                              <th>{t("Metadata")}</th>
                              <th>{t("Print check")}</th>
                              <th>{t("Pictures")}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((g) => (
                              <Row
                                key={g.gameKey}
                                g={g}
                                onOpen={() => {
                                  onPick(c.consoleName, g.title, g.gameKey);
                                  onOpenChange(false);
                                }}
                              />
                            ))}
                          </tbody>
                        </table>
                      )}
                    </section>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {autoFill && (
        <AutoFillDialog
          open
          onOpenChange={(o) => {
            if (o) return;
            setAutoFill(null);
            void reload();
          }}
          consoleId={autoFill.consoleId}
          consoleName={autoFill.consoleName}
        />
      )}
      {metaSweep && (
        <MetaSweepDialog
          open
          onOpenChange={(o) => {
            if (o) return;
            setMetaSweep(null);
            void reload();
          }}
          consoleId={metaSweep.consoleId}
          consoleName={metaSweep.consoleName}
        />
      )}
    </>
  );
}

function Stat({ n, label, tone }: { n: number; label: string; tone?: "bad" }) {
  return (
    <span className={cn(n === 0 ? "text-muted-foreground" : tone === "bad" ? "text-destructive" : "text-amber-500")}>
      <strong>{n}</strong> {label}
    </span>
  );
}

const yes = <Check className="size-3.5 text-emerald-500" />;
const no = <Minus className="size-3.5 text-amber-500" />;

function Row({ g, onOpen }: { g: GameStatus; onOpen: () => void }) {
  const t = useT();
  const framesTone =
    g.framesTotal === 0
      ? "text-muted-foreground"
      : g.framesFilled === g.framesTotal
        ? "text-emerald-500"
        : "text-amber-500";
  return (
    <tr
      className="cursor-pointer border-t hover:bg-accent [&>td]:px-2.5 [&>td]:py-1"
      onClick={onOpen}
      title={t("Open in the editor")}
    >
      <td className="max-w-56 truncate text-[13px]">{g.title}</td>
      <td>{g.hasDesign ? yes : no}</td>
      <td className={cn("tabular-nums", framesTone)}>
        {g.framesTotal ? `${g.framesFilled} / ${g.framesTotal}` : "—"}
      </td>
      <td>{g.hasMeta ? yes : no}</td>
      <td>
        {g.errors > 0 ? (
          <span className="text-destructive">{t("{n} error(s)", { n: g.errors })}</span>
        ) : g.warnings > 0 ? (
          <span className="text-amber-500">{t("{n} warning(s)", { n: g.warnings })}</span>
        ) : (
          yes
        )}
      </td>
      <td>
        {g.sharesPictureWith.length > 0 ? (
          <span className="flex items-center gap-1 text-amber-500" title={g.sharesPictureWith.join(", ")}>
            <AlertTriangle className="size-3.5 shrink-0" />
            <span className="truncate">{t("Also on {titles}", { titles: g.sharesPictureWith.join(", ") })}</span>
          </span>
        ) : (
          yes
        )}
      </td>
    </tr>
  );
}
