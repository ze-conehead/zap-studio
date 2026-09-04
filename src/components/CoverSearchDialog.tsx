import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { resolveLibretroRepo, searchCovers, type CoverCandidate } from "../covers";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

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
    { status: "loading" } | { status: "done"; results: CoverCandidate[] } | { status: "error"; message: string }
  >({ status: "loading" });

  useEffect(() => {
    if (!open) return;
    setState({ status: "loading" });
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
  }, [open, consoleName, gameTitle]);

  const supported = !!resolveLibretroRepo(consoleName);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cover für „{gameTitle}"</DialogTitle>
        </DialogHeader>

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
            Für „{consoleName}" gibt es keine automatische Cover-Datenbank (nur
            Retro-/Emulations-Konsolen sind abgedeckt). Bitte Cover manuell über
            „+ Bild → Von URL einfügen" hinzufügen.
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
                  src={c.url}
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
