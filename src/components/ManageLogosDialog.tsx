// Settings ▸ Manage logos: the user's own logo library. Drop image files,
// whole folders or a .zip (nested folders are fine) — they're kept in the
// browser's IndexedDB and, with "Logo source: Local", found by file name
// when a console asks for its logo.

import { FolderOpen, Loader2, Search, Trash2, Upload, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getLogoSource, normalizeTitle, setLogoSource } from "../covers";
import { useT } from "../i18n";
import {
  addLocalLogos,
  ensureLocalLogosLoaded,
  getLocalLogosVersion,
  listLocalLogos,
  localLogoUrl,
  logosFromDataTransfer,
  logosFromFileList,
  removeAllLocalLogos,
  removeLocalLogo,
  subscribeLocalLogos,
  type AddedLogo,
  type LocalLogo,
} from "../localLogos";
import { askConfirm } from "./ConfirmDialog";

const SHOWN = 60; // thumbnails rendered at once — the filter narrows it down

export function ManageLogosDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useT();
  useSyncExternalStore(subscribeLocalLogos, getLocalLogosVersion, getLocalLogosVersion);
  const logos = listLocalLogos();
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("");
  const [over, setOver] = useState(false);
  const [, bump] = useState(0);

  useEffect(() => {
    if (open) {
      void ensureLocalLogosLoaded();
      setError("");
      setNote("");
    }
  }, [open]);

  const q = normalizeTitle(filter);
  const shown = useMemo(() => {
    const all = q
      ? logos.filter((l) => normalizeTitle(`${l.path} ${l.name}`).includes(q))
      : logos;
    return { list: all.slice(0, SHOWN), total: all.length };
  }, [logos, q]);

  const ingest = async (inputs: AddedLogo[]) => {
    if (!inputs.length) return;
    setError("");
    setNote("");
    setBusy({ done: 0, total: inputs.length });
    try {
      const r = await addLocalLogos(inputs, (done, total) => setBusy({ done, total }));
      setNote(
        t("{added} added, {replaced} replaced, {skipped} skipped.", {
          added: r.added,
          replaced: r.replaced,
          skipped: r.skipped,
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const clearAll = async () => {
    const ok = await askConfirm({
      title: t("Remove all {n} logos?", { n: logos.length }),
      body: t("Cards that already use one of them keep their copy."),
      confirmLabel: t("Remove all"),
      destructive: true,
    });
    if (ok) await removeAllLocalLogos();
  };

  const source = getLogoSource();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-3xl flex-col gap-3">
        <DialogHeader>
          <DialogTitle>{t("Manage logos")}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          {t(
            "Your own logo files, kept in this browser and shared by every project. With “Logo source: Local” the logo search matches them by file name — name each file after its console (“Super Nintendo.png”), folders are fine too.",
          )}
        </p>

        <div
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-4 text-center text-sm transition-colors",
            over ? "border-primary bg-primary/10" : "border-muted-foreground/30",
          )}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void logosFromDataTransfer(e.dataTransfer).then(ingest);
          }}
        >
          <Upload className="size-5 text-muted-foreground" />
          <span>{t("Drop logos, folders or a .zip here")}</span>
          <div className="flex flex-wrap justify-center gap-1.5">
            <Button variant="outline" size="sm" disabled={!!busy} onClick={() => fileRef.current?.click()}>
              <Upload /> {t("Add files or .zip …")}
            </Button>
            <Button variant="outline" size="sm" disabled={!!busy} onClick={() => folderRef.current?.click()}>
              <FolderOpen /> {t("Add folder …")}
            </Button>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,.zip"
            multiple
            hidden
            onChange={(e) => {
              if (e.target.files?.length) void ingest(logosFromFileList(e.target.files));
              e.target.value = "";
            }}
          />
          <input
            ref={folderRef}
            type="file"
            hidden
            // Non-standard but supported by Chromium (and so Electron).
            {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
            onChange={(e) => {
              if (e.target.files?.length) void ingest(logosFromFileList(e.target.files));
              e.target.value = "";
            }}
          />
          {busy && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              {t("{done} / {total} …", { done: busy.done, total: busy.total })}
            </span>
          )}
        </div>

        {(note || error) && (
          <span className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
            {error || note}
          </span>
        )}

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t("Filter …")}
              className="h-8 pl-7 pr-7 text-xs"
            />
            {filter && (
              <button
                className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
                title={t("Clear")}
                onClick={() => setFilter("")}
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <span className="text-xs tabular-nums text-muted-foreground">
            {q ? `${shown.total} / ${logos.length}` : logos.length}
          </span>
          {logos.length > 0 && (
            <Button variant="ghost" size="sm" className="h-8 text-destructive" onClick={() => void clearAll()}>
              <Trash2 /> {t("Remove all")}
            </Button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border p-2">
          {logos.length === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">{t("No logos yet.")}</p>
          ) : shown.total === 0 ? (
            <p className="p-4 text-center text-xs text-muted-foreground">{t("Nothing matches.")}</p>
          ) : (
            <>
              <ul className="grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-6">
                {shown.list.map((l) => (
                  <LogoTile key={l.id} logo={l} onRemove={() => void removeLocalLogo(l.id).then(() => bump((n) => n + 1))} />
                ))}
              </ul>
              {shown.total > SHOWN && (
                <p className="pt-2 text-center text-[11px] text-muted-foreground">
                  {t("{n} more — narrow it down with the filter.", { n: shown.total - SHOWN })}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
          <span>
            {t("Logo source")}: <b>{source === "local" ? t("Local") : "SteamGridDB"}</b>
          </span>
          {source !== "local" ? (
            <Button variant="outline" size="sm" onClick={() => (setLogoSource("local"), bump((n) => n + 1))}>
              {t("Use local logos")}
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => (setLogoSource("sgdb"), bump((n) => n + 1))}>
              {t("Use SteamGridDB")}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LogoTile({ logo, onRemove }: { logo: LocalLogo; onRemove: () => void }) {
  const t = useT();
  const [url, setUrl] = useState<string | undefined>();
  useEffect(() => {
    let alive = true;
    void localLogoUrl(logo.id).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [logo.id]);
  return (
    <li className="group relative flex flex-col gap-1 rounded-md border p-1.5" title={logo.path ? `${logo.path}/${logo.name}` : logo.name}>
      <div className="canvas-checker flex aspect-[3/2] items-center justify-center overflow-hidden rounded">
        {url ? (
          <img src={url} alt={logo.name} loading="lazy" className="max-h-full max-w-full object-contain p-1" />
        ) : (
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        )}
      </div>
      <span className="truncate text-[11px]">{logo.name}</span>
      {logo.path && <span className="truncate text-[10px] text-muted-foreground">{logo.path}</span>}
      <button
        type="button"
        className="absolute right-1 top-1 hidden rounded bg-background/80 p-1 text-muted-foreground hover:text-destructive group-hover:block"
        title={t("Remove")}
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" />
      </button>
    </li>
  );
}
