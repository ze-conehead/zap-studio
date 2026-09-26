// Settings ▸ Cut & fold lines …: the spot colour (name + CMYK tint) used
// for the cover PDF's optional cut and fold lines (Export to print ▸ the
// cover PDF). Global, not per-workspace — see src/spotColors.ts.

import { useEffect, useState } from "react";
import {
  DEFAULT_CUT_SPOT,
  DEFAULT_SCORE_SPOT,
  getCutLineSpot,
  getScoreLineSpot,
  setCutLineSpot,
  setScoreLineSpot,
  spotColorCss,
  type SpotColor,
} from "../spotColors";
import { useT } from "../i18n";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Label } from "./ui/label";

const CHANNELS = ["c", "m", "y", "k"] as const;

function SpotColorFields({
  label,
  value,
  onChange,
  onReset,
}: {
  label: string;
  value: SpotColor;
  onChange: (v: SpotColor) => void;
  onReset: () => void;
}) {
  const t = useT();
  const pct = (v: number) => Math.round(v * 100);
  const setChannel = (ch: (typeof CHANNELS)[number], raw: number) =>
    onChange({ ...value, [ch]: Math.max(0, Math.min(100, raw)) / 100 });

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">{label}</Label>
        <button
          type="button"
          className="text-[11px] text-muted-foreground underline hover:text-foreground"
          onClick={onReset}
        >
          {t("Reset to default")}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="size-7 shrink-0 rounded ring-1 ring-border"
          style={{ background: spotColorCss(value) }}
          aria-hidden
        />
        <Input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder="kiss_cut"
          className="h-8"
        />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {CHANNELS.map((ch) => (
          <label key={ch} className="flex flex-col gap-1 text-[11px] text-muted-foreground">
            {ch.toUpperCase()} %
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              value={pct(value[ch])}
              onChange={(e) => setChannel(ch, Number(e.target.value) || 0)}
              className="h-8"
            />
          </label>
        ))}
      </div>
    </div>
  );
}

export function SpotColorDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [cut, setCut] = useState<SpotColor>(DEFAULT_CUT_SPOT);
  const [score, setScore] = useState<SpotColor>(DEFAULT_SCORE_SPOT);

  useEffect(() => {
    if (open) {
      setCut(getCutLineSpot());
      setScore(getScoreLineSpot());
    }
  }, [open]);

  const save = () => {
    setCutLineSpot(cut);
    setScoreLineSpot(score);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-md flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("Cut & fold lines")}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          {t(
            "Spot colours for the cover PDF's optional cut and fold lines (Export to print ▸ the double-sided cover PDF). Each is a Separation colour in CMYK, 0–100 % per channel.",
          )}
        </p>

        <SpotColorFields
          label={t("Cut line")}
          value={cut}
          onChange={setCut}
          onReset={() => setCut(DEFAULT_CUT_SPOT)}
        />
        <SpotColorFields
          label={t("Fold line")}
          value={score}
          onChange={setScore}
          onReset={() => setScore(DEFAULT_SCORE_SPOT)}
        />

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("Cancel")}
          </Button>
          <Button size="sm" onClick={save}>
            {t("Save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
