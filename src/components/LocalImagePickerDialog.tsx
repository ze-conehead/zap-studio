// Search-and-preview picker for one logo or cover from the user's local
// library — used by the repeating-image pattern and the "Add layer" menu.
// A plain <select>/dropdown falls over with a couple thousand entries
// (every option mounts as a DOM node); this only ever renders a page of
// thumbnails at a time, like CoverSearchDialog.

import { useEffect, useState, useSyncExternalStore } from "react";
import { normalizeTitle } from "../covers";
import { useT } from "../i18n";
import {
  ensureLocalCoversLoaded,
  ensureLocalLogosLoaded,
  getLocalCoversVersion,
  getLocalLogosVersion,
  listLocalCovers,
  listLocalLogos,
  localCoverUrl,
  localLogoUrl,
  subscribeLocalCovers,
  subscribeLocalLogos,
  type LocalLogo,
} from "../localLogos";
import { useCardBackdrop } from "../logoBackdrop";
import { LogoThumb } from "./LogoThumb";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";

const PAGE = 60;

export function LocalImagePickerDialog({
  open,
  onOpenChange,
  onPick,
  kind = "logo",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (id: string) => void;
  kind?: "logo" | "cover";
}) {
  const t = useT();
  const isCover = kind === "cover";
  // A logo is previewed on the open project's own card background.
  const backdrop = useCardBackdrop(undefined, true);
  useSyncExternalStore(
    isCover ? subscribeLocalCovers : subscribeLocalLogos,
    isCover ? getLocalCoversVersion : getLocalLogosVersion,
    isCover ? getLocalCoversVersion : getLocalLogosVersion,
  );
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE);

  useEffect(() => {
    if (!open) return;
    void (isCover ? ensureLocalCoversLoaded() : ensureLocalLogosLoaded());
    setQuery("");
    setVisible(PAGE);
  }, [open, isCover]);

  const all = isCover ? listLocalCovers() : listLocalLogos();
  const q = normalizeTitle(query);
  const filtered = q ? all.filter((l) => normalizeTitle(l.name).includes(q)) : all;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] w-screen max-h-none max-w-none flex-col gap-3 rounded-none border-0">
        <DialogHeader>
          <DialogTitle>{isCover ? t("Pick a cover") : t("Pick a logo")}</DialogTitle>
        </DialogHeader>

        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setVisible(PAGE);
          }}
          placeholder={isCover ? t("Search covers …") : t("Search logos …")}
          autoFocus
        />

        <div className="min-h-0 flex-1 overflow-y-auto">
          {all.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              {isCover
                ? t("No covers yet — add some in Settings ▸ Manage covers …")
                : t("No logos yet — add some in Settings ▸ Manage logos …")}
            </p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-sm text-muted-foreground">
              {isCover
                ? t(
                    "None of your covers matches “{title}”. Try another search term, or add files under Settings ▸ Manage covers …",
                    { title: query },
                  )
                : t(
                    "None of your logos matches “{title}”. Try another search term, or add files under Settings ▸ Manage logos …",
                    { title: query },
                  )}
            </p>
          ) : (
            <>
              <div className="mx-auto grid max-w-5xl grid-cols-4 gap-3 sm:grid-cols-6">
                {filtered.slice(0, visible).map((l) => (
                  <ImageThumb key={l.id} logo={l} kind={kind} backdrop={backdrop} onPick={() => onPick(l.id)} />
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

function ImageThumb({
  logo,
  kind,
  backdrop,
  onPick,
}: {
  logo: LocalLogo;
  kind: "logo" | "cover";
  backdrop: string | null | undefined;
  onPick: () => void;
}) {
  const [url, setUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    void (kind === "cover" ? localCoverUrl(logo.id) : localLogoUrl(logo.id)).then((u) => {
      if (alive) setUrl(u);
    });
    return () => {
      alive = false;
    };
  }, [logo.id, kind]);

  return (
    <button
      type="button"
      className="group flex flex-col items-center gap-1 rounded-md border p-1.5 text-left hover:border-primary"
      title={logo.name}
      onClick={onPick}
    >
      {kind === "cover" ? (
        <img src={url} alt="" loading="lazy" className="aspect-[3/4] w-full rounded bg-muted object-contain" />
      ) : (
        <LogoThumb src={url} backdrop={backdrop} className="aspect-square w-full p-2" />
      )}
      <span className="w-full truncate text-[11px] text-muted-foreground group-hover:text-foreground">
        {logo.name}
      </span>
    </button>
  );
}
