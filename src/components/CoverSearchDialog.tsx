import { Loader2, RotateCcw, Search } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  coverSourceLabel,
  effectiveSource,
  getCoverSource,
  getIgdbCreds,
  getSgdbKey,
  isConfigured,
  resolveLibretroRepo,
  searchCovers,
  searchLogos,
  searchScreenshots,
  setCoverSource,
  setIgdbCreds,
  setSgdbKey,
  type CoverCandidate,
  type CoverSource,
} from "../covers";
import { useT } from "../i18n";
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
  // Sweep mode ("All consoles"): step through every image-less card.
  progress?: { index: number; total: number };
  onSkip?: () => void;
  busy?: boolean;
  // "logo" searches SteamGridDB's logo set (transparent wordmarks) instead of
  // box art. Only SteamGridDB has those, so the source picker is hidden.
  kind?: "cover" | "logo" | "screenshot";
  /** Screenshot mode: which frame is being filled, for the heading. */
  shotIndex?: number;
}

type KeyedSource = Exclude<CoverSource, "libretro">;

// The sources that appear as buttons in the picker, in order. "igdb-shots"
// is IGDB reused for gameplay screenshots instead of box art.
const PICKABLE: readonly KeyedSource[] = ["sgdb", "igdb", "igdb-shots"];

const CRED_LINK: Record<KeyedSource, string> = {
  sgdb: "https://www.steamgriddb.com/profile/preferences/api",
  igdb: "https://dev.twitch.tv/console/apps",
  "igdb-shots": "https://dev.twitch.tv/console/apps",
};

// How many covers to show per "page" — a fresh search starts here, "More"
// reveals the next batch. Keeps the grid (and image loads) bounded.
const PAGE = 12;

export function CoverSearchDialog({
  open,
  onOpenChange,
  consoleName,
  gameTitle,
  onPick,
  progress,
  onSkip,
  busy = false,
  kind = "cover",
  shotIndex,
}: Props) {
  const t = useT();
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "done"; results: CoverCandidate[] }
    | { status: "error"; message: string }
  >({ status: "loading" });
  const [visible, setVisible] = useState(PAGE);
  const [query, setQuery] = useState(gameTitle);
  const [source, setSource] = useState<CoverSource>("sgdb");
  const [editing, setEditing] = useState(false);
  const [sgKey, setSgKey] = useState("");
  const [igId, setIgId] = useState("");
  const [igSecret, setIgSecret] = useState("");

  // Only the latest search updates the results.
  const runId = useRef(0);
  const runSearch = useCallback(
    (rawTerm: string) => {
      const term = rawTerm.trim();
      if (!term) return;
      const id = ++runId.current;
      setState({ status: "loading" });
      setVisible(PAGE);
      (kind === "logo"
        ? searchLogos(term)
        : kind === "screenshot"
          ? searchScreenshots(consoleName, term)
          : searchCovers(consoleName, term))
        .then((results) => {
          if (runId.current === id) setState({ status: "done", results });
        })
        .catch((e: Error) => {
          if (runId.current === id) setState({ status: "error", message: e.message });
        });
    },
    [consoleName, kind],
  );

  // Auto-search when the dialog opens or the target game changes (sweep mode).
  useEffect(() => {
    if (!open) return;
    setQuery(gameTitle);
    runSearch(gameTitle);
  }, [open, gameTitle, runSearch]);

  // Reset the credentials sub-panel when the dialog opens.
  useEffect(() => {
    if (!open) return;
    const s = getCoverSource();
    setSource(s);
    setEditing(!isConfigured(s));
    setSgKey(getSgdbKey());
    const c = getIgdbCreds();
    setIgId(c.clientId);
    setIgSecret(c.clientSecret);
  }, [open]);

  const logoMode = kind === "logo";
  const shotMode = kind === "screenshot";
  const src: KeyedSource = logoMode ? "sgdb" : (source as KeyedSource);
  const configured = isConfigured(src);
  const active = logoMode ? "sgdb" : effectiveSource();
  const supported = active !== "libretro" || !!resolveLibretroRepo(consoleName);
  const term = query.trim() || gameTitle;
  const search = () => runSearch(term);

  const pickSource = (s: CoverSource) => {
    setSource(s);
    setCoverSource(s);
    setEditing(!isConfigured(s));
    search();
  };

  const saveCreds = () => {
    if (src === "sgdb") setSgdbKey(sgKey);
    else setIgdbCreds(igId, igSecret);
    setEditing(false);
    search();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] w-screen max-h-none max-w-none flex-col gap-3 rounded-none border-0">
        <DialogHeader>
          <DialogTitle>
            {progress
              ? (logoMode
                  ? t("Logo {n} / {total}:", { n: progress.index + 1, total: progress.total })
                  : shotMode
                    ? t("Screenshot {n} / {total}:", {
                        n: shotIndex ?? progress.index,
                        total: progress.total - 1,
                      })
                    : t("Cover ({n} of {total})", {
                        n: progress.index + 1,
                        total: progress.total,
                      }) + ":") + " "
              : (logoMode
                  ? t("Logo for")
                  : shotMode
                    ? t("Screenshot {n} for", { n: shotIndex ?? 1 })
                    : t("Cover for")) + " "}
            “{gameTitle}”
            {progress && (
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                ({consoleName})
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-1.5">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder={t("Search term")}
          />
          <Button size="icon" title={t("Search")} onClick={search}>
            <Search />
          </Button>
        </div>

        <div className="flex flex-col gap-2 rounded-md border bg-muted/40 p-2.5 text-xs">
          <div className={cn("flex flex-wrap gap-1", logoMode && "hidden")}>
            {PICKABLE.map((s) => (
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
                {coverSourceLabel(s)}
              </button>
            ))}
          </div>

          {configured && !editing ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">
                {t("Credentials saved")}
                {active === "libretro" && t(" (but search uses libretro – see below)")}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-7"
                onClick={() => setEditing(true)}
              >
                {t("Change")}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <span className="text-muted-foreground">
                {t("{source} credentials – free at ", {
                  source: src === "sgdb" ? "SteamGridDB" : "IGDB",
                })}
                <a
                  href={CRED_LINK[src]}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {src === "sgdb" ? "steamgriddb.com" : "dev.twitch.tv"}
                </a>
                {t(". Requests are proxied locally by the dev server; the key stays on this machine.")}
              </span>
              {src === "sgdb" ? (
                <div className="flex gap-1.5">
                  <Input
                    className="h-7"
                    value={sgKey}
                    onChange={(e) => setSgKey(e.target.value)}
                    placeholder={t("API key")}
                    onKeyDown={(e) => e.key === "Enter" && saveCreds()}
                  />
                  <Button size="sm" className="h-7" onClick={saveCreds}>
                    {t("Save")}
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  <Input
                    className="h-7"
                    value={igId}
                    onChange={(e) => setIgId(e.target.value)}
                    placeholder={t("Client ID")}
                  />
                  <div className="flex gap-1.5">
                    <Input
                      className="h-7"
                      value={igSecret}
                      onChange={(e) => setIgSecret(e.target.value)}
                      placeholder={t("Client secret")}
                      onKeyDown={(e) => e.key === "Enter" && saveCreds()}
                    />
                    <Button size="sm" className="h-7" onClick={saveCreds}>
                      {t("Save")}
                    </Button>
                  </div>
                </div>
              )}
              <span className="text-muted-foreground">
                {logoMode
                  ? t("Logos come from SteamGridDB only — an API key is required.")
                  : t("Without credentials: libretro-thumbnails (retro / emulated consoles only).")}
              </span>
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
        {state.status === "loading" && (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />{" "}
            {logoMode
              ? t("Searching logos …")
              : shotMode
                ? t("Searching screenshots …")
                : t("Searching covers …")}
          </div>
        )}

        {state.status === "error" && (
          <div className="flex flex-col items-start gap-3 py-6">
            <p className="text-sm text-destructive">{state.message}</p>
            <Button variant="outline" size="sm" onClick={search}>
              <RotateCcw /> {t("Try again")}
            </Button>
          </div>
        )}

        {state.status === "done" && !supported && (
          <p className="py-6 text-sm text-muted-foreground">
            {t("Without credentials there's no cover database for \u201c{name}\u201d (libretro-thumbnails only covers retro / emulated consoles). Enter credentials above or add a cover manually via \u201c+ Image \u2192 Add from URL\u201d.", { name: consoleName })}
          </p>
        )}

        {state.status === "done" && supported && state.results.length === 0 && (
          <p className="py-6 text-sm text-muted-foreground">
            {logoMode
              ? t("No logos found for \u201c{title}\u201d.", { title: term })
              : shotMode
                ? t("No screenshots found for \u201c{title}\u201d.", { title: term })
                : t("No covers found for \u201c{title}\u201d.", { title: term })}
          </p>
        )}

        {state.status === "done" && state.results.length > 0 && (
          <>
            <div className="mx-auto grid max-w-5xl grid-cols-4 gap-3">
              {state.results.slice(0, visible).map((c) => (
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
                    className={cn(
                      "w-full rounded object-contain",
                      logoMode
                        ? "canvas-checker aspect-[3/2] p-2"
                        : shotMode
                          ? "aspect-[4/3] bg-muted"
                          : "aspect-[3/4] bg-muted",
                    )}
                  />
                  <span className="w-full truncate text-[11px] text-muted-foreground group-hover:text-foreground">
                    {c.region || c.title}
                  </span>
                </button>
              ))}
            </div>
            {state.results.length > visible && (
              <div className="flex justify-center pt-4">
                <Button variant="outline" onClick={() => setVisible((v) => v + PAGE)}>
                  {t("More")} ({state.results.length - visible})
                </Button>
              </div>
            )}
          </>
        )}
        </div>

        {(onSkip || busy) && (
          <div className="flex items-center justify-between border-t pt-3">
            <span className="text-xs text-muted-foreground">
              {busy ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" /> {t("inserting …")}
                </span>
              ) : (
                logoMode
                  ? t("Click a logo to insert it – then it moves to the next console.")
                  : t("Click a cover to insert it – then it moves to the next card.")
              )}
            </span>
            {onSkip && (
              <Button variant="outline" size="sm" disabled={busy} onClick={onSkip}>
                {t("Skip")}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
