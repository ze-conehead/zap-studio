import { Download } from "lucide-react";
import { useEffect, useState } from "react";
import { MARKS_MARGIN_MM } from "../card";
import { modeFor, type ExportMode } from "../export";
import { getFormat } from "../formats";
import { useT } from "../i18n";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

// The single-card PNG export: bleed and crop marks are independent choices
// (all four combinations), remembered for next time.

const KEY = "stickerstudio:pngExport";

function load(): { bleed: boolean; marks: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as { bleed?: unknown; marks?: unknown } | null;
    if (v && typeof v.bleed === "boolean" && typeof v.marks === "boolean") {
      return { bleed: v.bleed, marks: v.marks };
    }
  } catch {
    /* unavailable / malformed */
  }
  return { bleed: true, marks: false };
}

export function PngExportDialog({
  open,
  onOpenChange,
  onExport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (mode: ExportMode) => void;
}) {
  const t = useT();
  const f = getFormat();
  const [bleed, setBleed] = useState(true);
  const [marks, setMarks] = useState(false);

  useEffect(() => {
    if (!open) return;
    const v = load();
    setBleed(v.bleed);
    setMarks(v.marks);
  }, [open]);

  // The file's size: the trim, plus the bleed on each side, plus the white
  // margin the marks sit in.
  const extra = (bleed ? 2 * f.bleedMM : 0) + (marks ? 2 * MARKS_MARGIN_MM : 0);
  const w = +(f.trimMM.w + extra).toFixed(1);
  const h = +(f.trimMM.h + extra).toFixed(1);

  const run = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ bleed, marks }));
    } catch {
      /* the choice just isn't remembered */
    }
    onOpenChange(false);
    onExport(modeFor(bleed, marks));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("PNG export")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-1">
          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox className="mt-0.5" checked={bleed} onCheckedChange={(v) => setBleed(!!v)} />
            <span>
              {t("Include bleed ({n} mm)", { n: f.bleedMM })}
              <span className="block text-xs text-muted-foreground">
                {t("The artwork runs {n} mm past the cut edge, so a cut that drifts doesn't leave a white rim.", {
                  n: f.bleedMM,
                })}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-2.5 text-sm">
            <Checkbox className="mt-0.5" checked={marks} onCheckedChange={(v) => setMarks(!!v)} />
            <span>
              {t("Crop marks")}
              <span className="block text-xs text-muted-foreground">
                {t("Short lines at the corners to cut along{folds}. Adds a {n} mm white margin around the card.", {
                  n: MARKS_MARGIN_MM,
                  folds: f.panels?.length ? t(" (and at the folds)") : "",
                })}
              </span>
            </span>
          </label>

          <p className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground">
            {t("File size: {w} × {h} mm", { w, h })}
          </p>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("Cancel")}
          </Button>
          <Button onClick={run}>
            <Download /> {t("Export PNG")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
