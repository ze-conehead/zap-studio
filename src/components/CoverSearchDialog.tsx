import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getSgdbKey,
  resolveLibretroRepo,
  searchCovers,
  setSgdbKey,
  usingSGDB,
  type CoverCandidate,
} from "../covers";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consoleName: string;
  gameTitle: string;
  onPick: (url: string) => void;
}

export function CoverSearchDialog({
  open,
  onOpenChange,
  consoleName,
  gameTitle,
  onPick,
}: Props) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "done"; results: CoverCandidate[] }
    | { status: "error"; message: string }
  >({ status: "loading" });
  const [reloadKey, setReloadKey] = useState(0);
  const [keyInput, setKeyInput] = useState("");
  const [editKey, setEditKey] = useState(false);

  const sgdb = usingSGDB();

  useEffect(() => {
    if (!open) return;
    setState({ status: "loading" });
    setEditKey(false);
    setKeyInput(getSgdbKey());
    let cancelled = false;
    searchCovers(consoleName, gameTitle)
      .then((results) => {
        if (!cancelled) setState({ status: "done", results });
      })
      .catch((e: Error) => {
        if (!cancelled) setState({ status: "error", message: e.message });
      });
    return () => {
      cancelled = true;
    };
  }, [open, consoleName, gameTitle, reloadKey]);

  const supported = sgdb || !!resolveLibretroRepo(consoleName);

  const saveKey = () => {
    setSgdbKey(keyInput);
    setEditKey(false);
    setReloadKey((n) => n + 1);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cover für „{gameTitle}"</DialogTitle>
        </DialogHeader>

        <div className="rounded-md border bg-muted/40 p-2.5 text-xs">
          {sgdb && !editKey ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                Quelle: <strong className="text-foreground">SteamGridDB</strong>{" "}
                (API-Key hinterlegt)
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => {
                  setKeyInput(getSgdbKey());
                  setEditKey(true);
                }}
              >
                Key ändern
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground">
                SteamGridDB-API-Key (alle Konsolen, hohe Auflösung) – kostenlos
                unter{" "}
                <a
                  href="https://www.steamgriddb.com/profile/preferences/api"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  steamgriddb.com
                </a>
                . Anfragen laufen über den Proxy proxy.cors.sh.
              </span>
              <div className="flex gap-1.5">
                <Input
                  className="h-7"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="API-Key einfügen …"
                  onKeyDown={(e) => e.key === "Enter" && saveKey()}
                />
                <Button size="sm" className="h-7" onClick={saveKey}>
                  Speichern
                </Button>
              </div>
              {!sgdb && (
                <span className="text-muted-foreground">
                  Ohne Key: libretro-thumbnails (nur Retro-/Emulations-Konsolen).
                </span>
              )}
            </div>
          )}
        </div>

        {state.status === "loading" && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Suche Cover …
          </div>
        )}

        {state.status === "error" && (
          <p className="py-6 text-sm text-destructive">{state.message}</p>
        )}

        {state.status === "done" && !supported && (
          <p className="py-6 text-sm text-muted-foreground">
            Für „{consoleName}" gibt es ohne SteamGridDB-Key keine Cover-Datenbank
            (libretro-thumbnails deckt nur Retro-/Emulations-Konsolen ab). Key oben
            eintragen oder Cover manuell über „+ Bild → Von URL einfügen" hinzufügen.
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
                className="group flex flex-col items-center gap-1 rounded-md border p-1.5 text-left hover:border-primary"
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
      </DialogContent>
    </Dialog>
  );
}
