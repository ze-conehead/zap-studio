// Export a double-sided print PDF for a wrap-style cover (DVD case, Switch
// case, …): the cover's own trim+bleed size, centered on an A4 sheet in
// whichever orientation fits, one page per side (front, then the inside).
// Same page size and offset on both pages, so a duplex printer lands the
// cover in exactly the same spot front and back.

import { FileDown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { downloadBlob, exportPng } from "../export";
import { getFormat } from "../formats";
import { useT } from "../i18n";
import { cardTrayPdf, type CardPdfPage, type PdfCutRect, type PdfScoreLines } from "../pdf";
import { getCutLineSpot, getScoreLineSpot, spotColorCss } from "../spotColors";
import { useStore } from "../store";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import type { CanvasHandle } from "./EditorCanvas";

const A4_MM = { w: 210, h: 297 };

// Belt-and-suspenders: whatever step is actually stuck (a canvas call some
// browser privacy setting silently alters, an image that never fires load
// or error, …), the dialog must not sit there forever with no feedback —
// it should say which step, so a report of "nothing happens" turns into an
// actionable error instead.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms / 1000}s`)),
      ms,
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e: unknown) => {
        clearTimeout(timer);
        reject(e as Error);
      },
    );
  });
}

// Internal panel boundaries (trim-relative mm, left to right) — where a
// wrap format's fold/score lines go. Empty for a single-panel format.
function foldXsMM(panels: { wMM: number }[] | undefined): number[] {
  if (!panels || panels.length < 2) return [];
  const xs: number[] = [];
  let acc = 0;
  for (let i = 0; i < panels.length - 1; i++) {
    acc += panels[i].wMM;
    xs.push(acc);
  }
  return xs;
}

export function CoverPdfDialog({
  open,
  onOpenChange,
  canvas,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canvas: React.MutableRefObject<CanvasHandle | null>;
}) {
  const t = useT();
  const { state } = useStore();
  const { project } = state;
  const f = getFormat();
  const cutSpot = getCutLineSpot();
  const scoreSpot = getScoreLineSpot();
  const folds = foldXsMM(f.panels);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cutLine, setCutLine] = useState(false);
  const [scoreLine, setScoreLine] = useState(false);

  useEffect(() => {
    if (open) {
      setError("");
      setCutLine(false);
      setScoreLine(false);
    }
  }, [open]);

  const cardWidthMM = f.trimMM.w + f.bleedMM * 2;
  const cardHeightMM = f.trimMM.h + f.bleedMM * 2;
  const fitsPortrait = cardWidthMM <= A4_MM.w && cardHeightMM <= A4_MM.h;
  const fitsLandscape = cardWidthMM <= A4_MM.h && cardHeightMM <= A4_MM.w;
  const fits = fitsPortrait || fitsLandscape;
  const pageWidthMM = fitsPortrait ? A4_MM.w : A4_MM.h;
  const pageHeightMM = fitsPortrait ? A4_MM.h : A4_MM.w;
  const offsetXMM = (pageWidthMM - cardWidthMM) / 2;
  const offsetYMM = (pageHeightMM - cardHeightMM) / 2;

  const safeName = () =>
    project.name.replace(/[^\w-]+/g, "_").slice(0, 40) || "sticker";

  const run = async () => {
    const front = canvas.current?.getStage("front");
    const back = canvas.current?.getStage("back");
    const w = canvas.current?.getStageWidth() ?? 0;
    if (!front || !back || !w || !fits) return;
    setBusy(true);
    setError("");
    try {
      // The trim edge, inset from the bleed-sized cover by the format's
      // own bleed — same rect/lines on both pages, since both share one
      // offset.
      const cutRect: PdfCutRect | undefined = cutLine
        ? {
            xMM: offsetXMM + f.bleedMM,
            yMM: offsetYMM + f.bleedMM,
            wMM: f.trimMM.w,
            hMM: f.trimMM.h,
            rMM: f.cornerRadiusMM,
          }
        : undefined;
      const scoreLines: PdfScoreLines | undefined =
        scoreLine && folds.length
          ? {
              xsMM: folds.map((x) => offsetXMM + f.bleedMM + x),
              yMM: offsetYMM + f.bleedMM,
              hMM: f.trimMM.h,
            }
          : undefined;
      const page = async (stage: typeof front, label: string): Promise<CardPdfPage> => ({
        imageDataUrl: await withTimeout(
          exportPng({ stage, stageWidth: w, mode: "bleed" }),
          15000,
          `Capturing the ${label}`,
        ),
        cardWidthMM,
        cardHeightMM,
        pageWidthMM,
        pageHeightMM,
        offsetXMM,
        offsetYMM,
        cutRect,
        cutSpot,
        scoreLines,
        scoreSpot,
      });
      const frontPage = await page(front, "front");
      const backPage = await page(back, "inside");
      const blob = await withTimeout(
        cardTrayPdf([frontPage, backPage]),
        15000,
        "Building the PDF",
      );
      downloadBlob(blob, `${safeName()}_cover.pdf`);
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // A to-scale preview: the A4 page, the cover centered on it, and the
  // cut/fold lines exactly where the PDF will draw them.
  const BOX = 200;
  const PAD = 10;
  const scale = Math.min(
    (BOX - PAD * 2) / pageWidthMM,
    (BOX - PAD * 2) / pageHeightMM,
  );
  const pw = pageWidthMM * scale;
  const ph = pageHeightMM * scale;
  const px = (BOX - pw) / 2;
  const py = (BOX - ph) / 2;
  const cw = cardWidthMM * scale;
  const ch = cardHeightMM * scale;
  const cx = px + offsetXMM * scale;
  const cy = py + offsetYMM * scale;
  const trimX = cx + f.bleedMM * scale;
  const trimY = cy + f.bleedMM * scale;
  const trimW = f.trimMM.w * scale;
  const trimH = f.trimMM.h * scale;

  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? null : onOpenChange(o))}>
      <DialogContent className="flex max-h-[88vh] max-w-md flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("Cover PDF – double-sided")}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          {t(
            "Two pages, front then inside, each the cover at {w} × {h} mm (with bleed) centered on an A4 sheet — print both sides at “actual size / 100 %”, never “fit to page”.",
            { w: cardWidthMM, h: cardHeightMM },
          )}
        </p>

        <svg
          width={BOX}
          height={BOX}
          role="img"
          aria-label={t("Cover position on the A4 page")}
          className="mx-auto shrink-0 rounded-md border bg-muted/30"
        >
          <rect
            x={px}
            y={py}
            width={pw}
            height={ph}
            fill="var(--muted)"
            stroke="var(--border)"
            strokeWidth={1}
          />
          <rect
            x={cx}
            y={cy}
            width={cw}
            height={ch}
            fill="var(--primary)"
            fillOpacity={0.25}
            stroke="var(--primary)"
            strokeWidth={1.5}
          />
          {cutLine && (
            <rect
              x={trimX}
              y={trimY}
              width={trimW}
              height={trimH}
              rx={f.cornerRadiusMM * scale}
              fill="none"
              stroke={spotColorCss(cutSpot)}
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          )}
          {scoreLine &&
            folds.map((x) => {
              const lx = trimX + x * scale;
              return (
                <line
                  key={x}
                  x1={lx}
                  y1={trimY}
                  x2={lx}
                  y2={trimY + trimH}
                  stroke={spotColorCss(scoreSpot)}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                />
              );
            })}
        </svg>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox checked={cutLine} onCheckedChange={(v) => setCutLine(!!v)} />
          {t("Cut line as a vector path ({name}, spot colour)", { name: cutSpot.name })}
        </label>
        {folds.length > 0 && (
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <Checkbox checked={scoreLine} onCheckedChange={(v) => setScoreLine(!!v)} />
            {t("Fold line as a vector path ({name}, spot colour)", { name: scoreSpot.name })}
          </label>
        )}

        {!fits && (
          <span className="text-xs text-destructive">
            {t("The cover ({w} × {h} mm) doesn't fit on an A4 sheet.", {
              w: Math.round(cardWidthMM),
              h: Math.round(cardHeightMM),
            })}
          </span>
        )}
        {error && <span className="text-xs text-destructive">{error}</span>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("Cancel")}
          </Button>
          <Button size="sm" disabled={busy || !fits} onClick={() => void run()}>
            {busy ? <Loader2 className="animate-spin" /> : <FileDown />}
            {t("Export PDF")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
