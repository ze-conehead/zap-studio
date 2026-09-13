// Manage uploaded font files: add more, see what's there, remove one. The
// per-layer font picker (Inspector) can also upload on the fly — this is the
// tidy-up place, and works with no text layer selected.

import { Loader2, Trash2, Upload } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  addCustomFont,
  ensureCustomFontsLoaded,
  getCustomFontsVersion,
  listCustomFonts,
  removeCustomFont,
  subscribeCustomFonts,
} from "../customFonts";
import { useT } from "../i18n";

export function CustomFontsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  useSyncExternalStore(subscribeCustomFonts, getCustomFontsVersion, getCustomFontsVersion);
  const fonts = listCustomFonts();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) void ensureCustomFontsLoaded();
  }, [open]);

  const uploadFiles = async (files: FileList) => {
    setBusy(true);
    setError("");
    try {
      for (const f of files) await addCustomFont(f);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] max-w-md flex-col gap-4">
        <DialogHeader>
          <DialogTitle>{t("Custom fonts")}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          {t(
            "Font files stay on this machine, in this project. They show up in every text layer's font picker.",
          )}
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border">
          {fonts.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">
              {t("No custom fonts yet.")}
            </p>
          ) : (
            <ul className="divide-y">
              {fonts.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center gap-2 px-3 py-2 text-sm"
                >
                  <span className="flex-1 truncate" style={{ fontFamily: f.family }}>
                    {f.name}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    title={t("Remove")}
                    onClick={() => void removeCustomFont(f.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {error && <span className="text-xs text-destructive">{error}</span>}

        <div className="flex justify-end">
          <Button disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? <Loader2 className="animate-spin" /> : <Upload />}
            {t("Upload font …")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".ttf,.otf,.woff,.woff2"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) void uploadFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
