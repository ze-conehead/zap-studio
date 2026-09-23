// "All cards as PNG": one file per card (plus one per back side where a
// card has one), in a .zip grouped by console. Same offscreen render path
// as the cut sheet — a hidden <CardStage> per card at full 300-dpi size,
// captured through exportPng() so trim / bleed / crop marks match the
// single-card export exactly.

import type Konva from "konva";
import { FileDown, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { zipSync } from "fflate";
import { CANVAS, TRIM_RECT } from "../card";
import type { DemoCard } from "../demo";
import { packImageSources } from "../demo";
import { downloadBlob, EXPORT_MODES, exportLabel, exportPng, type ExportMode } from "../export";
import { ensureFontsLoaded } from "../fonts";
import { preloadImage } from "../hooks/useImage";
import { useT } from "../i18n";
import { listGameDesigns, loadSheetCards, type SheetGame } from "../sheet";
import { getWorkspace } from "../workspace";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { CardStage } from "./CardStage";

type Phase = "pick" | "rendering" | "done" | "error";

// A file/folder-safe name: no path separators or characters Windows rejects.
const safe = (s: string) =>
  s.replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim() || "card";

function dataUrlToBytes(dataUrl: string): Uint8Array {
  const b64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function ExportAllDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [phase, setPhase] = useState<Phase>("pick");
  const [games, setGames] = useState<SheetGame[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [mode, setMode] = useState<ExportMode>("trim");
  const [dedupeBacks, setDedupeBacks] = useState(true);
  const [cards, setCards] = useState<DemoCard[]>([]);
  const [count, setCount] = useState(0);
  const [error, setError] = useState("");

  // One stage per face: index i = front of cards[i], cards.length + i = back.
  const stages = useRef<(Konva.Stage | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    setPhase("pick");
    setCards([]);
    setError("");
    listGameDesigns().then((g) => {
      setGames(g);
      setPicked(new Set(g.map((x) => x.gameKey)));
    });
  }, [open]);

  const start = async () => {
    const keys = games.map((g) => g.gameKey).filter((k) => picked.has(k));
    if (!keys.length) return;
    setPhase("rendering");
    setError("");
    try {
      const loaded = await loadSheetCards(keys);
      if (!loaded.length) throw new Error(t("Nothing to export."));
      await ensureFontsLoaded();
      await Promise.all(packImageSources(loaded).map(preloadImage));
      stages.current = [];
      setCards(loaded);
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  };

  // Once the hidden stages have painted: capture, zip, download.
  useEffect(() => {
    if (phase !== "rendering" || !cards.length) return;
    let alive = true;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!alive) return;
        (async () => {
          try {
            const files: Record<string, Uint8Array> = {};
            // Most cards inherit their back from the console or global
            // template, so the same image would otherwise be written once
            // per card — dedupeBacks keeps just the first file for each
            // distinct back (by its actual rendered pixels).
            const backPaths = new Map<string, string>(); // dataUrl -> path already written
            let n = 0;
            for (let i = 0; i < cards.length; i++) {
              const c = cards[i];
              const folder = safe(c.consoleName);
              const name = safe(c.gameTitle);
              const front = stages.current[i];
              if (front) {
                const png = await exportPng({ stage: front, stageWidth: CANVAS.w, mode });
                files[`${folder}/${name}.png`] = dataUrlToBytes(png);
                n++;
              }
              const back = stages.current[cards.length + i];
              if (back) {
                const png = await exportPng({ stage: back, stageWidth: CANVAS.w, mode });
                if (dedupeBacks) {
                  if (!backPaths.has(png)) {
                    const path = `Backs/${folder} – ${name}.png`;
                    backPaths.set(png, path);
                    files[path] = dataUrlToBytes(png);
                    n++;
                  }
                } else {
                  files[`${folder}/${name} (back).png`] = dataUrlToBytes(png);
                  n++;
                }
              }
            }
            if (!alive) return;
            // PNGs are already compressed — storing them is much faster.
            const zipped = zipSync(files, { level: 0 });
            downloadBlob(
              new Blob([zipped], { type: "application/zip" }),
              `${safe(getWorkspace().name)} – ${t("cards")}.zip`,
            );
            setCount(n);
            setCards([]);
            setPhase("done");
          } catch (e) {
            if (alive) {
              setError((e as Error).message);
              setPhase("error");
            }
          }
        })();
      }),
    );
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
  }, [phase, cards, mode, dedupeBacks, t]);

  const toggle = (key: string) =>
    setPicked((p) => {
      const n = new Set(p);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  const allPicked = games.length > 0 && picked.size === games.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-lg flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("All cards as PNG")}</DialogTitle>
        </DialogHeader>

        {/* off-screen render targets — fronts, then backs */}
        {phase === "rendering" && cards.length > 0 && (
          <div aria-hidden style={{ position: "fixed", left: -20000, top: 0, opacity: 0 }}>
            {cards.map((c, i) => (
              <CardStage
                key={c.key}
                card={c}
                width={TRIM_RECT.w}
                stageRef={(s) => {
                  stages.current[i] = s;
                }}
              />
            ))}
            {cards.map((c, i) =>
              c.back ? (
                <CardStage
                  key={`${c.key}-back`}
                  card={c}
                  face="back"
                  width={TRIM_RECT.w}
                  stageRef={(s) => {
                    stages.current[cards.length + i] = s;
                  }}
                />
              ) : null,
            )}
          </div>
        )}

        {phase === "pick" && (
          <>
            <p className="text-xs text-muted-foreground">
              {t(
                "One PNG per card, sorted into a folder per console. Same three variants as the single export.",
              )}
            </p>

            <div className="flex gap-1 rounded-md border p-0.5 text-xs">
              {EXPORT_MODES.map((m) => (
                <button
                  key={m}
                  className={
                    "flex-1 rounded px-2 py-1.5 " +
                    (mode === m ? "bg-primary text-primary-foreground" : "hover:bg-accent")
                  }
                  onClick={() => setMode(m)}
                >
                  {exportLabel(m)}
                </button>
              ))}
            </div>

            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={dedupeBacks}
                onCheckedChange={(v) => setDedupeBacks(!!v)}
              />
              {t("One file per distinct back (most cards share the console's or global back)")}
            </label>

            {games.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t("No card has a design yet.")}
              </p>
            ) : (
              <>
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Checkbox
                    checked={allPicked}
                    onCheckedChange={(v) =>
                      setPicked(v ? new Set(games.map((g) => g.gameKey)) : new Set())
                    }
                  />
                  {t("{n} of {total} selected", { n: picked.size, total: games.length })}
                </label>
                <ul className="max-h-64 overflow-y-auto rounded-md border text-sm">
                  {games.map((g) => (
                    <li key={g.gameKey} className="border-b last:border-b-0">
                      <label className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5">
                        <Checkbox
                          checked={picked.has(g.gameKey)}
                          onCheckedChange={() => toggle(g.gameKey)}
                        />
                        <span className="truncate">{g.gameTitle}</span>
                        <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                          {g.consoleName}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                {t("Close")}
              </Button>
              <Button size="sm" disabled={picked.size === 0} onClick={() => void start()}>
                <FileDown /> {t("Export .zip")}
              </Button>
            </div>
          </>
        )}

        {phase === "rendering" && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            {t("Rendering {n} card(s) …", { n: picked.size })}
          </div>
        )}

        {phase === "done" && (
          <>
            <p className="text-sm">{t("{n} file(s) exported.", { n: count })}</p>
            <div className="flex justify-end">
              <Button size="sm" onClick={() => onOpenChange(false)}>
                {t("Close")}
              </Button>
            </div>
          </>
        )}

        {phase === "error" && (
          <>
            <p className="text-sm text-destructive">{error}</p>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setPhase("pick")}>
                {t("Back to selection")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
