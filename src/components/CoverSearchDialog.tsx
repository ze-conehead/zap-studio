import { Loader2, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import {
  effectiveSource,
  getCoverSource,
  getIgdbCreds,
  getSgdbKey,
  isConfigured,
  resolveLibretroRepo,
  searchCovers,
  setCoverSource,
  setIgdbCreds,
  setSgdbKey,
  type CoverCandidate,
  type CoverSource,
} from "../covers";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consoleName: string;
  gameTitle: string;
  onPick: (url: string) => void;
  // Sweep mode ("Alle Konsolen"): step through every image-less card.
  progress?: { index: number; total: number };
  onSkip?: () => void;
  busy?: boolean;
}

const SOURCE_LABEL: Record<Exclude<CoverSource, "libretro">, string> = {
  sgdb: "SteamGridDB",
  igdb: "IGDB",
};
const CRED_LINK: Record<Exclude<CoverSource, "libretro">, string> = {
  sgdb: "https://www.steamgriddb.com/profile/preferences/api",
  igdb: "https://dev.twitch.tv/console/apps",
};

export function CoverSearchDialog({
  open,
  onOpenChange,
  consoleName,
  gameTitle,
  onPick,
  progress,
  onSkip,
  busy = false,
}: Props) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "done"; results: CoverCandidate[] }
    | { status: "error"; message: string }
  >({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [source, setSource] = useState<CoverSource>("sgdb");
  const [editing, setEditing] = useState(false);
  const [sgKey, setSgKey] = useState("");
  const [igId, setIgId] = useState("");
  const [igSecret, setIgSecret] = useState("");

  useEffect(() => {
    if (!open) return;
    const s = getCoverSource();
    setSource(s);
    setEditing(!isConfigured(s));
    setSgKey(getSgdbKey());
    const c = getIgdbCreds();
    setIgId(c.clientId);
    setIgSecret(c.clientSecret);
    setState({ status: "loading" });
    let cancelled = false;
    searchCovers(consoleName, gameTitle)
      .then((results) => !cancelled && setState({ status: "done", results }))
      .catch((e: Error) => !cancelled && setState({ status: "error", message: e.message }));
    return () => {
      cancelled = true;
    };
  }, [open, consoleName, gameTitle, reloadKey]);

  const src = source as Exclude<CoverSource, "libretro">;
  const configured = isConfigured(src);
  const active = effectiveSource();
  const supported = active !== "libretro" || !!resolveLibretroRepo(consoleName);

  const pickSource = (s: CoverSource) => {
    setSource(s);
    setCoverSource(s);
    setEditing(!isConfigured(s));
    setReloadKey((n) => n + 1);
  };

  const saveCreds = () => {
    if (src === "sgdb") setSgdbKey(sgKey);
    else setIgdbCreds(igId, igSecret);
    setEditing(false);
    setReloadKey((n) => n + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {progress ? `Cover ${progress.index + 1} / ${progress.total}: ` : "Cover für "}
            „{gameTitle}"
            {progress && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                ({consoleName})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-2.5 text-xs">
          <div className="flex gap-1">
            {(["sgdb", "igdb"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => pickSource(s)}
                className={cn(
                  "rounded px-2.5 py-1 font-medium",
                  source === s
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent",
                )}
              >
                {SOURCE_LABEL[s]}
              </button>
            ))}
          </div>

          {configured && !editing ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                Zugangsdaten hinterlegt
                {active === "libretro" && " (aber Suche nutzt libretro – s. u.)"}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => setEditing(true)}
              >
                Ändern
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground">
                {SOURCE_LABEL[src]}-Zugangsdaten – kostenlos unter{" "}
                <a
                  href={CRED_LINK[src]}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {src === "sgdb" ? "steamgriddb.com" : "dev.twitch.tv"}
                </a>
                . Anfragen laufen über den Proxy proxy.cors.sh.
              </span>
              {src === "sgdb" ? (
                <div className="flex gap-1.5">
                  <Input
                    className="h-7"
                    value={sgKey}
                    onChange={(e) => setSgKey(e.target.value)}
                    placeholder="API-Key"
                    onKeyDown={(e) => e.key === "Enter" && saveCreds()}
                  />
                  <Button size="sm" className="h-7" onClick={saveCreds}>
                    Speichern
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Input
                    className="h-7"
                    value={igId}
                    onChange={(e) => setIgId(e.target.value)}
                    placeholder="Client-ID"
                  />
                  <div className="flex gap-1.5">
                    <Input
                      className="h-7"
                      value={igSecret}
                      onChange={(e) => setIgSecret(e.target.value)}
                      placeholder="Client-Secret"
                      onKeyDown={(e) => e.key === "Enter" && saveCreds()}
                    />
                    <Button size="sm" className="h-7" onClick={saveCreds}>
                      Speichern
                    </Button>
                  </div>
                </div>
              )}
              <span className="text-muted-foreground">
                Ohne Zugangsdaten: libretro-thumbnails (nur Retro-/Emulations-Konsolen).
              </span>
            </div>
          )}
        </div>

        {state.status === "loading" && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Suche Cover …
          </div>
        )}

        {state.status === "error" && (
          <div className="flex flex-col items-start gap-3 py-6">
            <p className="text-sm text-destructive">{state.message}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setReloadKey((n) => n + 1)}
            >
              <RotateCcw /> Erneut versuchen
            </Button>
          </div>
        )}

        {state.status === "done" && !supported && (
          <p className="py-6 text-sm text-muted-foreground">
            Für „{consoleName}" gibt es ohne Zugangsdaten keine Cover-Datenbank
            (libretro-thumbnails deckt nur Retro-/Emulations-Konsolen ab).
            Zugangsdaten oben eintragen oder Cover manuell über „+ Bild → Von URL
            einfügen" hinzufügen.
          </p>
        )}

        {state.status === "done" && supported && state.results.length === 0 && (
          <p className="py-6 text-sm text-muted-foreground">
            Keine Cover für „{gameTitle}" gefunden.
          </p>
        )}

        {state.status === "done" && state.results.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {state.results.map((c) => (
              <button
                key={c.url}
                type="button"
                disabled={busy}
                className="group flex flex-col items-center gap-1 rounded-md border p-1.5 text-left hover:border-primary disabled:opacity-50"
                title={`${c.title} ${c.region}`.trim()}
                onClick={() => onPick(c.url)}
              >
                <img
                  src={c.thumb ?? c.url}
                  alt={c.title}
                  loading="lazy"
                  className="aspect-[3/4] w-full rounded bg-muted object-contain"
                />
                <span className="w-full truncate text-[11px] text-muted-foreground group-hover:text-foreground">
                  {c.region || c.title}
                </span>
              </button>
            ))}
          </div>
        )}

        {(onSkip || busy) && (
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">
              {busy ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" /> wird eingefügt …
                </span>
              ) : (
                "Cover anklicken zum Einfügen – dann geht es zur nächsten Karte."
              )}
            </span>
            {onSkip && (
              <Button variant="outline" size="sm" disabled={busy} onClick={onSkip}>
                Überspringen
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
