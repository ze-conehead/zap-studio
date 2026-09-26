// Help ▸ About — the app name, current version and a link to the project.

import { Zap } from "lucide-react";
import { APP_VERSION } from "../updateCheck";
import { useT } from "../i18n";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

export function AboutDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm gap-4">
        <DialogHeader className="items-center text-center">
          <div className="flex size-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Zap className="size-6" />
          </div>
          <DialogTitle>Zap-Studio</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center gap-2 text-center text-sm">
          <p className="text-muted-foreground">{t("Version {v}", { v: APP_VERSION })}</p>
          <p className="text-muted-foreground">
            {t("Design and export credit-card-sized console/game stickers, locally in your browser.")}
          </p>
          <a
            href="https://github.com/ze-conehead/zap-studio"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-primary hover:underline"
          >
            github.com/ze-conehead/zap-studio
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
