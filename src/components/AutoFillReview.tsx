import { AlertTriangle, ChevronRight, Loader2, Search, Trash2, Undo2 } from "lucide-react";
import { Fragment, useState } from "react";
import type { FilledFrame } from "../autoFill";
import { insertConsoleLogo, removeConsoleLayer, replaceConsoleLogo } from "../consoleLogos";
import { useT } from "../i18n";
import { insertMaskImages, removeGameLayer, replaceGameImage } from "../quickImport";
import { cn } from "@/lib/utils";
import { CoverSearchDialog } from "./CoverSearchDialog";
import { Button } from "./ui/button";

// After an auto-fill: every picture it put in, grouped per card, with
// one-click fixes — the next thing the source offered, a hand-picked one
// from the normal search dialog, or none at all. Each change is written
// straight to that design / template on disk.

interface Item extends FilledFrame {
  url: string; // what's in the frame now
  removed?: boolean;
  busy?: boolean;
}

export function AutoFillReview({ frames }: { frames: FilledFrame[] }) {
  const t = useT();
  const [items, setItems] = useState<Item[]>(() =>
    frames.map((f) => ({ ...f, url: f.candidates[f.index] })),
  );
  const [picking, setPicking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patch = (i: number, p: Partial<Item>) =>
    setItems((a) => a.map((x, k) => (k === i ? { ...x, ...p } : x)));

  // Puts `url` into item i: replaces its picture, or — if it was removed —
  // inserts a fresh layer for the same frame.
  const put = async (i: number, url: string, index?: number) => {
    const it = items[i];
    patch(i, { busy: true });
    setError(null);
    try {
      let layerId = it.layerId;
      if (it.removed) {
        if (it.kind === "logo") {
          layerId = await insertConsoleLogo({ consoleId: it.key, consoleName: it.consoleName }, url);
        } else if (it.mask) {
          const row = { gameKey: it.key, consoleName: it.consoleName, gameTitle: it.title };
          const [hit] = await insertMaskImages(row, [
            { url, mask: it.mask, name: it.kind === "cover" ? t("Main image") : it.mask.name },
          ]);
          if (!hit) throw new Error(t("That picture could not be loaded."));
          layerId = hit.layerId;
        }
      } else if (it.kind === "logo") {
        await replaceConsoleLogo(it.key, it.layerId, url);
      } else {
        await replaceGameImage(it.key, it.layerId, url, it.mask);
      }
      patch(i, { url, layerId, removed: false, busy: false, ...(index !== undefined ? { index } : {}) });
    } catch (e) {
      setError((e as Error).message);
      patch(i, { busy: false });
    }
  };

  const nextOf = (it: Item) => (it.index + 1) % it.candidates.length;

  const remove = async (i: number) => {
    const it = items[i];
    patch(i, { busy: true });
    if (it.kind === "logo") await removeConsoleLayer(it.key, it.layerId);
    else await removeGameLayer(it.key, it.layerId);
    patch(i, { removed: true, busy: false });
  };

  // Group consecutive items of the same card / console.
  const groups: { key: string; head: Item; idx: number[] }[] = [];
  items.forEach((it, i) => {
    const g = groups.find((x) => x.key === `${it.kind === "logo" ? "c" : "g"}:${it.key}`);
    if (g) g.idx.push(i);
    else groups.push({ key: `${it.kind === "logo" ? "c" : "g"}:${it.key}`, head: it, idx: [i] });
  });

  const picked = picking !== null ? items[picking] : null;

  // The same picture on several cards (similar titles return the same hits):
  // for each item, the other cards that got that picture too.
  const sharedWith = (it: Item): string[] => {
    if (it.removed || it.kind === "logo") return [];
    const titles = items
      .filter((o) => o !== it && !o.removed && o.kind !== "logo" && o.key !== it.key && o.url === it.url)
      .map((o) => o.title);
    return [...new Set(titles)];
  };

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {t("Check what was picked. “Next” takes the source’s next suggestion, “Choose” opens the search, the bin empties the frame. Changes are saved right away.")}
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="-mx-1 flex min-h-0 flex-col gap-3 overflow-y-auto px-1 pb-1">
        {groups.map((g) => (
          <div key={g.key} className="rounded-md border p-2">
            <div className="mb-1.5 truncate text-sm font-medium">
              {g.head.kind === "logo" ? t("Logo – {name}", { name: g.head.title }) : g.head.title}
              {g.head.kind !== "logo" && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">{g.head.consoleName}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {g.idx.map((i) => {
                const it = items[i];
                const m = it.mask;
                const aspect =
                  m && m.type === "shape"
                    ? Math.abs((m.width * m.scaleX) / (m.height * m.scaleY))
                    : 2;
                return (
                  <Fragment key={i}>
                    <div className="flex w-44 flex-col gap-1">
                      <div
                        className="canvas-checker relative overflow-hidden rounded border"
                        style={{ aspectRatio: String(aspect) }}
                      >
                        {it.removed ? (
                          <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
                            {t("Empty")}
                          </div>
                        ) : (
                          <img
                            src={it.url}
                            alt=""
                            draggable={false}
                            className={cn(
                              "absolute inset-0 size-full",
                              it.kind === "logo" ? "object-contain p-1" : "object-cover",
                            )}
                          />
                        )}
                        {it.busy && (
                          <div className="absolute inset-0 grid place-items-center bg-black/40">
                            <Loader2 className="size-4 animate-spin text-white" />
                          </div>
                        )}
                      </div>
                      {sharedWith(it).length > 0 && (
                        <span
                          className="flex items-center gap-1 text-[11px] text-amber-500"
                          title={sharedWith(it).join(", ")}
                        >
                          <AlertTriangle className="size-3 shrink-0" />
                          <span className="truncate">
                            {t("Also on {titles}", { titles: sharedWith(it).join(", ") })}
                          </span>
                        </span>
                      )}
                      <div className="flex items-center gap-0.5">
                        <span className="mr-auto truncate text-[11px] text-muted-foreground">
                          {it.kind === "logo" ? t("Logo") : it.mask?.name}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          disabled={it.busy || it.candidates.length < 2}
                          title={t("Next suggestion ({n} / {total})", {
                            n: nextOf(it) + 1,
                            total: it.candidates.length,
                          })}
                          onClick={() => void put(i, it.candidates[nextOf(it)], nextOf(it))}
                        >
                          <ChevronRight className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-6"
                          disabled={it.busy}
                          title={t("Choose …")}
                          onClick={() => setPicking(i)}
                        >
                          <Search className="size-3.5" />
                        </Button>
                        {it.removed ? (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            disabled={it.busy}
                            title={t("Put it back")}
                            onClick={() => void put(i, it.url)}
                          >
                            <Undo2 className="size-3.5" />
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-6"
                            disabled={it.busy}
                            title={t("Empty the frame")}
                            onClick={() => void remove(i)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </Fragment>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {picked && (
        <CoverSearchDialog
          open
          onOpenChange={(o) => !o && setPicking(null)}
          consoleName={picked.consoleName}
          gameTitle={picked.title}
          kind={picked.kind}
          onPick={(url) => {
            const i = picking as number;
            setPicking(null);
            void put(i, url);
          }}
        />
      )}
    </div>
  );
}
