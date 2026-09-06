import type Konva from "konva";
import { ChevronLeft, ChevronRight, Loader2, Scissors } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { zipSync, strToU8 } from "fflate";
import { TRIM_RECT } from "../card";
import type { DemoCard } from "../demo";
import { packImageSources } from "../demo";
import { downloadBlob } from "../export";
import { ensureFontsLoaded } from "../fonts";
import { preloadImage } from "../hooks/useImage";
import { useT } from "../i18n";
import { stickerSheetPdf } from "../pdf";
import {
  composeSheet,
  DEFAULT_SHEET_OPTIONS,
  listGameDesigns,
  loadSheetCards,
  PRINT_H_MM,
  PRINT_W_MM,
  type SheetGame,
  type SheetOptions,
  type SheetResult,
  type SheetTarget,
} from "../sheet";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { CardStage } from "./CardStage";

type Phase = "pick" | "rendering" | "done" | "error";

export function CutSheetDialog({
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
  const [opts, setOpts] = useState<SheetOptions>(DEFAULT_SHEET_OPTIONS);
  const [cards, setCards] = useState<DemoCard[]>([]);
  const [result, setResult] = useState<SheetResult | null>(null);
  const [pageIdx, setPageIdx] = useState(0);
  const [error, setError] = useState("");

  const stages = useRef<(Konva.Stage | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    setPhase("pick");
    setResult(null);
    setCards([]);
    setPageIdx(0);
    setError("");
    listGameDesigns().then((g) => {
      setGames(g);
      setPicked(new Set(g.map((x) => x.gameKey)));
    });
  }, [open]);

  const start = async () => {
    const keys = games
      .map((g) => g.gameKey)
      .filter((k) => picked.has(k));
    if (!keys.length) return;
    setPhase("rendering");
    setError("");
    try {
      const loaded = await loadSheetCards(keys);
      if (!loaded.length) throw new Error("empty");
      await ensureFontsLoaded();
      await Promise.all(packImageSources(loaded).map(preloadImage));
      stages.current = [];
      setCards(loaded);
    } catch (e) {
      setError((e as Error).message);
      setPhase("error");
    }
  };

  // Capture the hidden stages once painted, then build the sheet(s).
  useEffect(() => {
    if (phase !== "rendering" || !cards.length) return;
    let alive = true;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!alive) return;
        (async () => {
          try {
            const images = cards.map((_, i) => {
              const s = stages.current[i];
              return s ? s.toDataURL({ pixelRatio: 1 }) : "";
            });
            const r = await composeSheet(
              images.filter(Boolean),
              opts,
            );
            if (!alive) return;
            setResult(r);
            setPageIdx(0);
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
  }, [phase, cards, opts]);

  const wmd = opts.target === "wmd";

  const download = async () => {
    if (!result) return;

    if (wmd) {
      const pg = result.pages[0];
      const blob = await stickerSheetPdf({
        imageDataUrl: pg.dataUrl,
        widthMM: pg.widthMM,
        heightMM: pg.heightMM,
        bleedMM: pg.bleedMM,
        cutRects: pg.cutRects,
      });
      downloadBlob(blob, "sticker-sheet-wmd.pdf");
      return;
    }

    const files: Record<string, Uint8Array> = {};
    const multi = result.pages.length > 1;
    const mm1 = (v: number) => v.toFixed(1);
    const cm2 = (v: number) => (v / 10).toFixed(2);
    const sizeBlocks: string[] = [];
    result.pages.forEach((pg, i) => {
      const suffix = multi ? `_${i + 1}` : "";
      const b64 = pg.dataUrl.split(",")[1];
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
      files[`print${suffix}.png`] = bytes;
      files[`cut${suffix}.svg`] = strToU8(pg.cutSvg);
      const c = pg.cutBox;
      sizeBlocks.push(
        (multi ? `[${t("Sheet")} ${i + 1}]\n` : "") +
          t("  image   print{s}.png : {w} x {h} mm  ({wc} x {hc} cm)", {
            s: suffix,
            w: mm1(pg.widthMM),
            h: mm1(pg.heightMM),
            wc: cm2(pg.widthMM),
            hc: cm2(pg.heightMM),
          }) +
          "\n" +
          t("  cut     cut{s}.svg   : {w} x {h} mm  ({wc} x {hc} cm)", {
            s: suffix,
            w: mm1(c.wMM),
            h: mm1(c.hMM),
            wc: cm2(c.wMM),
            hc: cm2(c.hMM),
          }) +
          "\n" +
          t(
            "  offset  cut line from the image's top-left corner: {l} mm left, {tp} mm top",
            { l: mm1(c.xMM), tp: mm1(c.yMM) },
          ),
      );
    });
    files["README.txt"] = strToU8(
      t(
        "PRINT SIZE — print at 100 % / actual size, never “fit to page”, so the cut line lines up:",
      ) +
        "\n" +
        sizeBlocks.join("\n\n") +
        "\n\n" +
        t(
          "print*.png = the sticker sheet, each card printed full-bleed. cut*.svg = the matching cut line, one rounded path per card at the trim edge. Cricut Design Space: upload the SVG (the cut layer) and the PNG (Print then Cut image) at the same size so they line up, then Print then Cut. Or upload just the PNG and choose “Complex” to auto-trace (it will follow the bleed edge, not the rounded trim).",
        ) +
        "\n\n" +
        t(
          "If Design Space crops the SVG to the cut line, set the image size above, then move the cut layer so its top-left sits at the offset above (left / top) from the image's top-left.",
        ) +
        "\n",
    );
    const zipped = zipSync(files, { level: 6 });
    downloadBlob(
      new Blob([zipped], { type: "application/zip" }),
      "cricut-cut-sheet.zip",
    );
  };

  const errorText =
    error === "card-too-big"
      ? t("A single card is larger than the Cricut print area for this format.")
      : error === "empty" || error === "no cards"
        ? t("None of the selected games has a saved design.")
        : t("Could not build the sheet.");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[88vh] max-w-3xl flex-col">
        <DialogHeader>
          <DialogTitle>
            {wmd ? t("Sticker sheet for wir-machen-druck.de") : t("Cut sheet for Cricut")}
          </DialogTitle>
        </DialogHeader>

        {/* off-screen render targets */}
        {phase === "rendering" && cards.length > 0 && (
          <div
            aria-hidden
            style={{ position: "fixed", left: -20000, top: 0, opacity: 0 }}
          >
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
          </div>
        )}

        {phase === "pick" && (
          <>
            <div className="flex gap-1 rounded-md border p-0.5 text-xs">
              {(["cricut", "wmd"] as SheetTarget[]).map((tg) => (
                <button
                  key={tg}
                  className={
                    "flex-1 rounded px-2 py-1.5 " +
                    (opts.target === tg
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent")
                  }
                  onClick={() => setOpts((o) => ({ ...o, target: tg }))}
                >
                  {tg === "cricut"
                    ? t("Cricut Explore (Print then Cut)")
                    : t("wir-machen-druck.de (print PDF)")}
                </button>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              {wmd
                ? t(
                    "Builds a single print-ready PDF: every design on one sheet at real size, each card full-bleed, with a 2 mm outer bleed and a “kiss_cut” contour (100 % magenta spot colour) around each card — the cut line their production expects.",
                  )
                : t(
                    "Packs the finished designs onto {w} DPI sheets at real size — each card printed full-bleed — plus a matching SVG that cuts each card at its rounded trim edge. Print at 100 %, then Print then Cut on the Cricut.",
                    { w: "300" },
                  )}
            </p>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs">
              <label className="flex items-center gap-1.5">
                {t("Gap")}
                <input
                  type="number"
                  className="h-7 w-16 rounded border bg-transparent px-2"
                  value={opts.gapMM}
                  min={0}
                  step={0.5}
                  onChange={(e) =>
                    setOpts((o) => ({
                      ...o,
                      gapMM: Math.max(0, Number(e.target.value) || 0),
                    }))
                  }
                />
                mm
              </label>
              {!wmd && (
                <label className="flex items-center gap-1.5">
                  <Checkbox
                    checked={opts.background === "white"}
                    onCheckedChange={(v) =>
                      setOpts((o) => ({
                        ...o,
                        background: v ? "white" : "transparent",
                      }))
                    }
                  />
                  {t("White background")}
                </label>
              )}
            </div>

            {games.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">
                {t("No saved designs yet.")}
              </p>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
                <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
                  <span>{t("{n} game(s) selected", { n: picked.size })}</span>
                  <button
                    className="rounded px-1.5 hover:bg-accent"
                    onClick={() =>
                      setPicked((p) =>
                        p.size === games.length
                          ? new Set()
                          : new Set(games.map((g) => g.gameKey)),
                      )
                    }
                  >
                    {picked.size === games.length
                      ? t("Deselect all")
                      : t("Select all")}
                  </button>
                </div>
                <ul className="p-1">
                  {games.map((g) => (
                    <li key={g.gameKey}>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] hover:bg-accent">
                        <Checkbox
                          checked={picked.has(g.gameKey)}
                          onCheckedChange={() =>
                            setPicked((p) => {
                              const n = new Set(p);
                              n.has(g.gameKey)
                                ? n.delete(g.gameKey)
                                : n.add(g.gameKey);
                              return n;
                            })
                          }
                        />
                        <span className="flex-1 truncate">{g.gameTitle}</span>
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {g.consoleName}
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                {t("Cancel")}
              </Button>
              <Button size="sm" disabled={picked.size === 0} onClick={() => void start()}>
                <Scissors /> {t("Build sheet")}
              </Button>
            </div>
          </>
        )}

        {phase === "rendering" && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> {t("Rendering cards …")}
          </div>
        )}

        {phase === "error" && (
          <div className="flex flex-col items-start gap-3 py-8">
            <p className="text-sm text-destructive">{errorText}</p>
            <Button variant="outline" size="sm" onClick={() => setPhase("pick")}>
              {t("Back to selection")}
            </Button>
          </div>
        )}

        {phase === "done" && result && (
          <>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                {t("{cards} card(s) · {cols}×{rows} per sheet · {pages} sheet(s)", {
                  cards: cards.length,
                  cols: result.cols,
                  rows: result.rows,
                  pages: result.pages.length,
                })}
                {" · "}
                {t("print at {w}×{h} mm", {
                  w: result.pages[pageIdx].widthMM.toFixed(1),
                  h: result.pages[pageIdx].heightMM.toFixed(1),
                })}
              </span>
              {result.pages.length > 1 && (
                <span className="flex items-center gap-1">
                  <button
                    className="rounded p-1 hover:bg-accent disabled:opacity-30"
                    disabled={pageIdx === 0}
                    onClick={() => setPageIdx((i) => i - 1)}
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                  {pageIdx + 1} / {result.pages.length}
                  <button
                    className="rounded p-1 hover:bg-accent disabled:opacity-30"
                    disabled={pageIdx === result.pages.length - 1}
                    onClick={() => setPageIdx((i) => i + 1)}
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                </span>
              )}
            </div>

            <div
              className="grid min-h-0 flex-1 place-items-center overflow-auto rounded-md border p-3"
              style={{
                backgroundImage:
                  "repeating-conic-gradient(#e5e7eb 0% 25%, #f8fafc 0% 50%)",
                backgroundSize: "16px 16px",
              }}
            >
              <div className="relative w-fit shadow-lg">
                <img
                  src={result.pages[pageIdx].dataUrl}
                  alt=""
                  className="block max-h-[46vh] w-auto"
                />
                <div
                  className="pointer-events-none absolute inset-0 [&>svg]:h-full [&>svg]:w-full"
                  dangerouslySetInnerHTML={{
                    __html: result.pages[pageIdx].cutSvg,
                  }}
                />
              </div>
            </div>

            {!wmd && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 rounded-md border bg-muted/30 p-2.5 text-xs">
                <dt className="text-muted-foreground">{t("Image (print PNG)")}</dt>
                <dd className="font-mono">
                  {result.pages[pageIdx].widthMM.toFixed(1)} ×{" "}
                  {result.pages[pageIdx].heightMM.toFixed(1)} mm
                </dd>
                <dt className="text-muted-foreground">{t("Cut line (cut SVG)")}</dt>
                <dd className="font-mono">
                  {result.pages[pageIdx].cutBox.wMM.toFixed(1)} ×{" "}
                  {result.pages[pageIdx].cutBox.hMM.toFixed(1)} mm
                </dd>
                <dt className="text-muted-foreground">
                  {t("Cut line offset (left / top)")}
                </dt>
                <dd className="font-mono">
                  {result.pages[pageIdx].cutBox.xMM.toFixed(1)} /{" "}
                  {result.pages[pageIdx].cutBox.yMM.toFixed(1)} mm
                </dd>
              </dl>
            )}

            <p className="text-xs text-muted-foreground">
              {wmd
                ? t(
                    "Cyan = the “kiss_cut” contour. The PDF is one sheet, {w}×{h} mm incl. a 2 mm outer bleed, CMYK image + magenta spot cut line — upload it as the print data. Order the sheet at this exact size.",
                    {
                      w: result.pages[0].widthMM.toFixed(1),
                      h: result.pages[0].heightMM.toFixed(1),
                    },
                  )
                : t(
                    "Cyan = the cut line (cut.svg). The .zip has the full-bleed print PNG and the matching SVG; the README lists the exact print size. Fits the Cricut print area ({w}×{h} mm). Print at 100 %.",
                    { w: PRINT_W_MM, h: PRINT_H_MM },
                  )}
            </p>

            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPhase("pick")}>
                {t("Back to selection")}
              </Button>
              <Button size="sm" onClick={() => void download()}>
                {wmd ? t("Download PDF") : t("Download .zip (print + cut)")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
