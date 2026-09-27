// Search-and-preview picker for one logo from "Manage logos" — used by the
// repeating-image pattern. A plain <select>/dropdown falls over with a
// couple thousand entries (every option mounts as a DOM node); this only
// ever renders a page of thumbnails at a time, like CoverSearchDialog.

import { useEffect, useState, useSyncExternalStore } from "react";
import { normalizeTitle } from "../covers";
import { useT } from "../i18n";
import {
  ensureLocalLogosLoaded,
  getLocalLogosVersion,
  listLocalLogos,
  localLogoUrl,
  subscribeLocalLogos,
  type LocalLogo,
} from "../localLogos";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";

const PAGE = 60;

export function LogoPickerDialog({
  open,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (logoId: string) => void;
}) {
  const t = useT();
  useSyncExternalStore(subscribeLocalLogos, getLocalLogosVersion, getLocalLogosVersion);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE);

  useEffect(() => {
    if (!open) return;
    void ensureLocalLogosLoaded();
    setQuery("");
    setVisible(PAGE);
  }, [open]);

  const all = listLocalLogos();
  const q = normalizeTitle(query);
  const filtered = q ? all.filter((l) => normalizeTitle(l.name).includes(q)) : all;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] w-screen max-h-none max-w-none flex-col gap-3 rounded-none border-0">
        <DialogHeader>
          <DialogTitle>{t("Pick a logo")}</DialogTitle>
        </DialogHeader>

        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisible(PAGE);
          }}
          placeholder={t("Search logos …")}
          autoFocus
        />

        <div className="min-h-0 flex-1 overflow-y-auto">
          {all.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              {t("No logos yet — add some in Settings ▸ Manage logos …")}
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              {t(
                "None of your logos matches “{title}”. Try another search term, or add files under Settings ▸ Manage logos …",
                { title: query },
              )}
            </p>
          ) : (
            <>
              <div className="mx-auto grid max-w-5xl grid-cols-4 gap-3 sm:grid-cols-6">
                {filtered.slice(0, visible).map((l) => (
                  <LogoThumb key={l.id} logo={l} onPick={() => onPick(l.id)} />
                ))}
              </div>
              {filtered.length > visible && (
                <div className="flex justify-center pt-4">
                  <Button variant="outline" onClick={() => setVisible((v) => v + PAGE)}>
                    {t("More")} ({filtered.length - visible})
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LogoThumb({ logo, onPick }: { logo: LocalLogo; onPick: () => void }) {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void localLogoUrl(logo.id).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [logo.id]);

  return (
    <button
      type="button"
      className="group flex flex-col items-center gap-1 rounded-md border p-1.5 text-left hover:border-primary"
      title={logo.name}
      onClick={onPick}
    >
      <img
        src={url}
        alt=""
        loading="lazy"
        className="canvas-checker aspect-square w-full rounded object-contain p-2"
      />
      <span className="w-full truncate text-[11px] text-muted-foreground group-hover:text-foreground">
        {logo.name}
      </span>
    </button>
  );
}
