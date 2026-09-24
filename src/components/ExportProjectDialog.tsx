// Export the whole workspace as a .zip: every card plus the console and
// global templates by default, or — when only the shared building blocks
// are wanted, not every individual card — just the templates.

import { FileDown, Loader2 } from "lucide-react";
import { useState } from "react";
import { exportBackup } from "../backup";
import { downloadBlob } from "../export";
import { useT } from "../i18n";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export function ExportProjectDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  const [templatesOnly, setTemplatesOnly] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const run = async () => {
    setBusy(true);
    setError("");
    try {
      const { blob, name } = await exportBackup({ templatesOnly });
      downloadBlob(blob, name);
      onOpenChange(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? null : onOpenChange(o))}>
      <DialogContent className="flex max-w-md flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("Export project as .zip")}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          {t(
            "Everything in this workspace, bundled as one .zip — settings, fonts and the local libraries included.",
          )}
        </p>

        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <Checkbox
            checked={templatesOnly}
            onCheckedChange={(v) => setTemplatesOnly(!!v)}
          />
          {t("Templates only — the global and console layers, no individual cards")}
        </label>

        {error && <span className="text-xs text-destructive">{error}</span>}

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            {t("Cancel")}
          </Button>
          <Button size="sm" disabled={busy} onClick={() => void run()}>
            {busy ? <Loader2 className="animate-spin" /> : <FileDown />}
            {t("Export .zip")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
