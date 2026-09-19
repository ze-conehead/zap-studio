// Project ▸ Bleed …: how far the canvas extends past the trim, in mm.
// Applying moves every layer so nothing shifts on the printed card, then
// reloads (the canvas geometry is fixed at load, like the format).

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { parseLocaleNumber } from "@/lib/utils";
import { changeBleed, currentBleedMM } from "../bleed";
import { getBaseFormat, MAX_BLEED_MM } from "../formats";
import { useT } from "../i18n";

export function BleedDialog({
  open,
  onOpenChange,
  beforeApply,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Flushes the open project to disk so the move doesn't lose edits. */
  beforeApply: () => Promise<void>;
}) {
  const t = useT();
  const current = currentBleedMM();
  const own = getBaseFormat().bleedMM;
  const [text, setText] = useState(String(current));
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setText(String(current).replace(".", ","));
  }, [open, current]);

  const value = parseLocaleNumber(text);
  const valid = value !== undefined && value >= 0 && value <= MAX_BLEED_MM;
  const changed = valid && Math.abs(value - current) > 1e-9;

  const apply = async () => {
    if (!valid || !changed) return;
    setBusy(true);
    try {
      await beforeApply();
      await changeBleed(value);
    } catch (e) {
      alert((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="flex max-w-sm flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("Bleed")}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {t(
            "How far artwork runs past the trim on every side, so a cut that is slightly off shows no white edge. Print shops usually want 2–3 mm; 0 for a plain cut. Everything on your cards keeps its place — the canvas grows or shrinks around it.",
          )}
        </p>
        <div className="flex flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("Bleed (mm)")}</Label>
          <Input
            type="text"
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void apply()}
          />
          <span className="text-[11px] text-muted-foreground">
            {t("Format default: {n} mm", { n: own })}
            {value !== undefined && !valid && ` · ${t("0 to {max} mm", { max: MAX_BLEED_MM })}`}
          </span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {t("Applying reloads the app.")}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" disabled={busy} onClick={() => onOpenChange(false)}>
            {t("Cancel")}
          </Button>
          <Button size="sm" disabled={!changed || busy} onClick={() => void apply()}>
            {busy && <Loader2 className="animate-spin" />}
            {t("Apply")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
