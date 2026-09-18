// "All cards": a contact sheet of every game in the catalogue. Cards are
// rendered off-screen in chunks (a full catalogue can be hundreds of games,
// and each one is a Konva stage) and captured to PNGs as they finish, so the
// grid fills in progressively instead of freezing the tab.

import type Konva from "konva";
import { ImageOff, Loader2, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { packImageSources } from "../demo";
import { ensureFontsLoaded } from "../fonts";
import { previewCssVars } from "../formats";
import { preloadImage } from "../hooks/useImage";
import { useT } from "../i18n";
import { loadOverviewCards, type OverviewCard } from "../overview";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Slider } from "./ui/slider";
import { captureTrim, CardStage } from "./CardStage";

const THUMB_W = 260; // render width per card, in px
const CHUNK = 12; // cards rendered (and captured) per pass

export function OverviewDialog({
  open,
  onOpenChange,
  activeGameKey,
  onPick,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeGameKey?: string;
  onPick: (consoleName: string, gameTitle: string, gameKey: string) => void;
}) {
  const t = useT();
  const [cards, setCards] = useState<OverviewCard[]>([]);
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState<Set<string>>(new Set());
  const [done, setDone] = useState(0); // how many have been captured
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [onlyDesigned, setOnlyDesigned] = useState(true);
  const [size, setSize] = useState(150); // thumbnail width in px

  const stages = useRef<(Konva.Stage | null)[]>([]);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setCards([]);
    setThumbs({});
    setFailed(new Set());
    setDone(0);
    setError("");
    (async () => {
      try {
        await ensureFontsLoaded();
        const list = await loadOverviewCards();
        if (alive) setCards(list);
      } catch (e) {
        if (alive) setError((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  // Render + capture one chunk at a time, then advance.
  const batch = useMemo(
    () => cards.slice(done, done + CHUNK),
    [cards, done],
  );

  useEffect(() => {
    if (!open || !batch.length) return;
    let alive = true;
    // No `stages.current = []` reset here: the batch's <CardStage> refs
    // already fired during the commit that mounted them (refs run before
    // effects), so clearing the array now would only wipe what was just
    // written. Stale entries from a previous, longer batch are harmless —
    // the capture loop below only ever reads up to `batch.length`.
    (async () => {
      try {
        await Promise.all(
          packImageSources(batch.map((c) => c.card)).map(preloadImage),
        );
      } catch (e) {
        console.error("Overview: preloading images failed", e);
      }
      if (!alive) return;
      // Two frames: one for Konva to mount, one for it to paint.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!alive) return;
          const shot: Record<string, string> = {};
          const bad = new Set<string>();
          for (const [i, c] of batch.entries()) {
            const s = stages.current[i];
            if (!s) continue;
            // toDataURL() can throw (a tainted canvas, say) — one bad card
            // must not leave the rest stuck behind it spinning forever.
            try {
              shot[c.key] = captureTrim(s, THUMB_W);
            } catch (e) {
              console.error("Overview: couldn't render", c.gameTitle, e);
              bad.add(c.key);
            }
          }
          setThumbs((prev) => ({ ...prev, ...shot }));
          if (bad.size) setFailed((prev) => new Set([...prev, ...bad]));
          setDone((n) => n + batch.length);
        }),
      );
    })();
    return () => {
      alive = false;
    };
  }, [open, batch]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return cards.filter(
      (c) =>
        (!onlyDesigned || c.hasDesign) &&
        (!q ||
          c.gameTitle.toLowerCase().includes(q) ||
          c.consoleName.toLowerCase().includes(q)),
    );
  }, [cards, query, onlyDesigned]);

  // Grouped by console, in catalogue order.
  const groups = useMemo(() => {
    const by = new Map<string, { name: string; items: OverviewCard[] }>();
    for (const c of visible) {
      const g = by.get(c.consoleId) ?? { name: c.consoleName, items: [] };
      g.items.push(c);
      by.set(c.consoleId, g);
    }
    return [...by.values()];
  }, [visible]);

  const rendering = done < cards.length;
  const designed = cards.filter((c) => c.hasDesign).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] w-screen max-h-none max-w-none flex-col gap-3 rounded-none border-0">
        <DialogHeader>
          <DialogTitle>{t("All cards")}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex min-w-56 flex-1 items-center gap-1.5">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Filter by game or console …")}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={onlyDesigned}
              onCheckedChange={(v) => setOnlyDesigned(!!v)}
            />
            {t("Only cards with a design")}
          </label>
          <div className="flex w-44 items-center gap-2 text-xs text-muted-foreground">
            {t("Size")}
            <Slider
              min={90}
              max={280}
              step={10}
              value={[size]}
              onValueChange={([v]) => setSize(v)}
            />
          </div>
          <span className="text-xs text-muted-foreground">
            {t("{shown} of {total} card(s) · {designed} designed", {
              shown: visible.length,
              total: cards.length,
              designed,
            })}
          </span>
        </div>

        {/* Off-screen render targets for the chunk in flight. */}
        {batch.length > 0 && (
          <div
            aria-hidden
            style={{ position: "fixed", left: -20000, top: 0, opacity: 0 }}
          >
            {batch.map((c, i) => (
              <CardStage
                key={c.key}
                card={c.card}
                width={THUMB_W}
                stageRef={(s) => {
                  stages.current[i] = s;
                }}
              />
            ))}
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="min-h-0 flex-1 overflow-y-auto" style={previewCssVars()}>
          {!cards.length && !error ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {t("Rendering cards …")}
            </div>
          ) : (
            groups.map((g) => (
              <section key={g.name} className="mb-6">
                <h3 className="sticky top-0 z-10 mb-2 bg-background/90 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground backdrop-blur">
                  {g.name}{" "}
                  <span className="font-normal normal-case">({g.items.length})</span>
                </h3>
                <div
                  className="grid gap-3"
                  style={{
                    gridTemplateColumns: `repeat(auto-fill, minmax(${size}px, 1fr))`,
                  }}
                >
                  {g.items.map((c) => (
                    <button
                      key={c.key}
                      className={cn(
                        "group flex flex-col gap-1 text-left",
                        !c.hasDesign && "opacity-60 hover:opacity-100",
                      )}
                      title={`${c.gameTitle} – ${c.consoleName}`}
                      onClick={() => {
                        onPick(c.consoleName, c.gameTitle, c.key);
                        onOpenChange(false);
                      }}
                    >
                      <div
                        className={cn(
                          "relative overflow-hidden rounded-md bg-muted ring-1 ring-border transition group-hover:ring-2 group-hover:ring-primary",
                          c.key === activeGameKey && "ring-2 ring-primary",
                        )}
                        style={{
                          aspectRatio: "var(--aspect, 638 / 1011)",
                          borderRadius:
                            "var(--radius-x, 5.889%) / var(--radius-y, 3.716%)",
                        }}
                      >
                        {thumbs[c.key] ? (
                          <img
                            src={thumbs[c.key]}
                            alt={c.gameTitle}
                            draggable={false}
                            className="size-full object-cover"
                          />
                        ) : failed.has(c.key) ? (
                          <span
                            className="grid size-full place-items-center"
                            title={t("Couldn't render a preview for this card.")}
                          >
                            <ImageOff className="size-4 text-muted-foreground" />
                          </span>
                        ) : (
                          <span className="grid size-full place-items-center">
                            <Loader2 className="size-4 animate-spin text-muted-foreground" />
                          </span>
                        )}
                        {!c.hasDesign && (
                          <span className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[10px] text-white/80">
                            {t("no design")}
                          </span>
                        )}
                      </div>
                      <span className="truncate text-[11px] leading-tight text-muted-foreground group-hover:text-foreground">
                        {c.gameTitle}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {rendering ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                {t("Rendering {done} / {total} …", {
                  done,
                  total: cards.length,
                })}
              </>
            ) : (
              t("Click a card to open it in the editor.")
            )}
          </span>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            <X /> {t("Close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
