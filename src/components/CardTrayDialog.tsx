// Export a PDF for printing straight onto a blank PVC card through a
// printer's disc/card tray (e.g. Canon's "Disc Tray G/J/K/M" or "MP Tray").
// The tray is usually a lot bigger than the card, and exactly where the
// card ends up sitting on it is printer-specific — nothing we can know in
// advance. So this isn't a one-click export: pick the tray type, print once,
// measure the offset from a corner against the physical card, and adjust it
// here. Every nudge is saved per tray type (src/cardTraySettings.ts), so it
// only needs doing once.

import { Loader2, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  getLastTrayType,
  getTrayPreset,
  saveTrayPreset,
  setLastTrayType,
  TRAY_TYPES,
  type TrayType,
} from "../cardTraySettings";
import { downloadBlob, exportPng } from "../export";
import { getFormat } from "../formats";
import { useT } from "../i18n";
import { cardTrayPdf, type CardPdfPage } from "../pdf";
import { useStore } from "../store";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import type { CanvasHandle } from "./EditorCanvas";

const TRAY_LABELS: Record<TrayType, string> = {
  g: "G",
  jkm: "J / K / M",
  mp: "MP",
};

export function CardTrayDialog({
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
  const { trimMM } = getFormat();

  const [tray, setTray] = useState<TrayType>("jkm");
  const [pageW, setPageW] = useState(0);
  const [pageH, setPageH] = useState(0);
  const [offX, setOffX] = useState(0);
  const [offY, setOffY] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadPreset = (tt: TrayType) => {
    const p = getTrayPreset(tt);
    setPageW(p.pageWidthMM);
    setPageH(p.pageHeightMM);
    setOffX(p.offsetXMM);
    setOffY(p.offsetYMM);
  };

  useEffect(() => {
    if (!open) return;
    const tt = getLastTrayType();
    setTray(tt);
    loadPreset(tt);
    setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const pickTray = (tt: TrayType) => {
    setTray(tt);
    setLastTrayType(tt);
    loadPreset(tt);
  };

  const patch = (fields: Partial<Omit<ReturnType<typeof getTrayPreset>, "label">>) =>
    saveTrayPreset(tray, fields);

  const safeName = () =>
    project.name.replace(/[^\w-]+/g, "_").slice(0, 40) || "sticker";

  const run = async () => {
    const w = canvas.current?.getStageWidth() ?? 0;
    const front = canvas.current?.getStage("front");
    if (!front || !w) return;
    setBusy(true);
    setError("");
    try {
      const facePage = (imageDataUrl: string): CardPdfPage => ({
        imageDataUrl,
        cardWidthMM: trimMM.w,
        cardHeightMM: trimMM.h,
        pageWidthMM: pageW,
        pageHeightMM: pageH,
        offsetXMM: offX,
        offsetYMM: offY,
      });
      const pages: CardPdfPage[] = [
        facePage(await exportPng({ stage: front, stageWidth: w, mode: "trim" })),
      ];
      const back = project.back ? canvas.current?.getStage("back") : undefined;
      if (back) {
        pages.push(facePage(await exportPng({ stage: back, stageWidth: w, mode: "trim" })));
      }
      const blob = await cardTrayPdf(pages);
      downloadBlob(blob, `${safeName()}_card-tray.pdf`);
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // A to-scale preview: the tray page, and the card at its offset.
  const BOX = 200;
  const PAD = 10;
  const scale = Math.min(
    (BOX - PAD * 2) / Math.max(pageW, 1),
    (BOX - PAD * 2) / Math.max(pageH, 1),
  );
  const pw = pageW * scale;
  const ph = pageH * scale;
  const px = (BOX - pw) / 2;
  const py = (BOX - ph) / 2;
  const cw = trimMM.w * scale;
  const ch = trimMM.h * scale;
  const cx = px + offX * scale;
  const cy = py + offY * scale;

  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? null : onOpenChange(o))}>
      <DialogContent className="flex max-h-[88vh] max-w-lg flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("Card-tray printing")}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          {t(
            "For a printer's disc/card tray (e.g. Canon's). The tray is usually bigger than the card, and exactly where the card sits on it depends on your printer — print a test page, measure the offset from a corner against the real card, and adjust it below. Remembered per tray type.",
          )}
        </p>

        <div className="flex flex-col gap-1.5">
          <Label>{t("Tray type")}</Label>
          <div className="flex flex-wrap gap-1">
            {TRAY_TYPES.map((tt) => (
              <button
                key={tt}
                type="button"
                onClick={() => pickTray(tt)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium",
                  tray === tt
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {TRAY_LABELS[tt]}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-4">
          <svg
            width={BOX}
            height={BOX}
            role="img"
            aria-label={t("Card position on the tray page")}
            className="shrink-0 rounded-md border bg-muted/30"
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
              rx={Math.min(4, cw / 2, ch / 2)}
              fill="var(--primary)"
              fillOpacity={0.25}
              stroke="var(--primary)"
              strokeWidth={1.5}
            />
          </svg>

          <div className="grid flex-1 grid-cols-2 content-start gap-2">
            <NumField
              label={t("Page width (mm)")}
              value={pageW}
              onChange={(v) => {
                setPageW(v);
                patch({ pageWidthMM: v });
              }}
            />
            <NumField
              label={t("Page height (mm)")}
              value={pageH}
              onChange={(v) => {
                setPageH(v);
                patch({ pageHeightMM: v });
              }}
            />
            <NumField
              label={t("Card offset X (mm)")}
              value={offX}
              onChange={(v) => {
                setOffX(v);
                patch({ offsetXMM: v });
              }}
            />
            <NumField
              label={t("Card offset Y (mm)")}
              value={offY}
              onChange={(v) => {
                setOffY(v);
                patch({ offsetYMM: v });
              }}
            />
          </div>
        </div>

        {error && <span className="text-xs text-destructive">{error}</span>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("Cancel")}
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void run()}>
            {busy ? <Loader2 className="animate-spin" /> : <Printer />}
            {project.back ? t("Export PDF (front + back)") : t("Export PDF")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <Input
        type="number"
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className="h-8"
      />
    </label>
  );
}
