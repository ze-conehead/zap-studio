// The "Export" hub: was a nested dropdown inside File, now its own modal so
// the options (and the card's format-specific ones) have room to breathe.
// Every row hands off to a dialog that needs its own setup first — the PNG
// options (bleed / crop marks), the tray and cover PDFs, the multi-card
// exports — and this dialog closes as soon as one fires.

import { FileArchive, FileText, Image, Printer } from "lucide-react";
import { useState } from "react";
import { getFormat, isCard } from "../formats";
import { useT } from "../i18n";
import { useFileActions } from "./fileActions";
import { PngExportDialog } from "./PngExportDialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import type { CanvasHandle } from "./EditorCanvas";

function Row({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm hover:bg-accent"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" />
      {label}
    </button>
  );
}

const Section = ({ children }: { children: React.ReactNode }) => (
  <p className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground first:pt-0">
    {children}
  </p>
);

export function ExportDialog({
  open,
  onOpenChange,
  canvas,
  onOpenCardTray,
  onOpenCoverPdf,
  onOpenExportAll,
  onOpenCutSheet,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canvas: React.MutableRefObject<CanvasHandle | null>;
  onOpenCardTray: () => void;
  onOpenCoverPdf: () => void;
  onOpenExportAll: () => void;
  onOpenCutSheet: () => void;
}) {
  const t = useT();
  const file = useFileActions(canvas);
  const f = getFormat();
  const [pngOpen, setPngOpen] = useState(false);

  const closeThen = (run: () => void) => {
    onOpenChange(false);
    run();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-w-sm flex-col gap-1 p-3">
          <DialogHeader className="px-1 pt-1">
            <DialogTitle>{t("Export to print")}</DialogTitle>
          </DialogHeader>

          <Section>{t("This card")}</Section>
          <Row icon={Image} label={t("PNG …")} onClick={() => closeThen(() => setPngOpen(true))} />
          {isCard() && (
            <Row
              icon={Printer}
              label={t("PDF – card-tray printer …")}
              onClick={() => closeThen(onOpenCardTray)}
            />
          )}
          {f.hasBack && !!f.panels?.length && (
            <Row
              icon={FileArchive}
              label={t("PDF – cover, double-sided (front + inside)")}
              onClick={() => closeThen(onOpenCoverPdf)}
            />
          )}

          <Section>{t("Multiple cards")}</Section>
          <Row
            icon={FileArchive}
            label={t("All cards as PNG (.zip) …")}
            onClick={() => closeThen(onOpenExportAll)}
          />
          <Row icon={FileText} label={t("PDF …")} onClick={() => closeThen(onOpenCutSheet)} />
        </DialogContent>
      </Dialog>

      <PngExportDialog
        open={pngOpen}
        onOpenChange={setPngOpen}
        onExport={(mode) => void file.runExport(mode)}
      />
    </>
  );
}
