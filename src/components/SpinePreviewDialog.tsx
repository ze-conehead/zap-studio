import type Konva from "konva";
import { Download, Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PANELS, TRIM_RECT } from "../card";
import { packImageSources } from "../demo";
import { downloadBlob } from "../export";
import { ensureFontsLoaded } from "../fonts";
import { preloadImage } from "../hooks/useImage";
import { useT } from "../i18n";
import { loadOverviewCards, type OverviewCard } from "../overview";
import { saveProject } from "../persist";
import { hasSpine } from "../spine";
import { useStore } from "../store";
import { captureTrim, CardStage } from "./CardStage";
import { Button } from "./ui/button";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";

// Every case of a console standing side by side — what the "Spine
// background" (one picture spread over all the spines) looks like on the
// shelf. Each card is rendered the normal way (templates, own design and the
// spine slice), then its spine panel is cut out. A second view shows the
// whole wraps instead.

// Capture width of one card, full trim — wide enough that the narrow spine
// stays sharp.
const CAPTURE_W = 1400;
// The whole-wrap copy: shown small, but also what "Export PNG" uses in that
// view, so it's kept at a printable-ish size.
const FULL_W = 1000;

interface Strip {
  key: string;
  title: string;
  spine: string;
  full: string;
}

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("render failed"));
    img.src = src;
  });

// The spine panel of a captured trim image, plus a small copy of the whole.
async function cut(dataUrl: string): Promise<Pick<Strip, "spine" | "full">> {
  const img = await loadImg(dataUrl);
  const sp = PANELS.find((p) => p.name === "Spine");
  if (!sp) throw new Error("no spine");
  const k = img.naturalWidth / TRIM_RECT.w;
  const sx = (sp.x - TRIM_RECT.x) * k;
  const sw = sp.w * k;
  const a = document.createElement("canvas");
  a.width = Math.max(1, Math.round(sw));
  a.height = img.naturalHeight;
  a.getContext("2d")?.drawImage(img, sx, 0, sw, img.naturalHeight, 0, 0, a.width, a.height);
  const b = document.createElement("canvas");
  b.width = FULL_W;
  b.height = Math.round((img.naturalHeight / img.naturalWidth) * FULL_W);
  b.getContext("2d")?.drawImage(img, 0, 0, b.width, b.height);
  return { spine: a.toDataURL("image/png"), full: b.toDataURL("image/jpeg", 0.88) };
}

// All strips side by side in one PNG — the shelf as it would stand,
// optionally with a thin dark line where two cases meet.
async function shelfPng(srcs: string[], edges: boolean): Promise<Blob> {
  const imgs = await Promise.all(srcs.map(loadImg));
  const h = Math.max(...imgs.map((i) => i.naturalHeight));
  const line = edges ? Math.max(1, Math.round(h / 400)) : 0;
  const widths = imgs.map((i) => Math.round(i.naturalWidth * (h / i.naturalHeight)));
  const c = document.createElement("canvas");
  c.width = widths.reduce((a, w) => a + w, 0) + line * (imgs.length - 1);
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  let x = 0;
  imgs.forEach((img, i) => {
    if (i > 0 && line) {
      ctx.fillRect(x, 0, line, h);
      x += line;
    }
    ctx.drawImage(img, x, 0, widths[i], h);
    x += widths[i];
  });
  return new Promise((res, rej) =>
    c.toBlob((b) => (b ? res(b) : rej(new Error("export failed"))), "image/png"),
  );
}

export function SpinePreviewDialog({
  open,
  onOpenChange,
  consoleId,
  consoleName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consoleId: string;
  consoleName: string;
}) {
  const t = useT();
  const { state } = useStore();
  const [cards, setCards] = useState<OverviewCard[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [strips, setStrips] = useState<Strip[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const [edges, setEdges] = useState(true);
  const stage = useRef<Konva.Stage | null>(null);
  const [saving, setSaving] = useState(false);

  const exportShelf = async () => {
    setSaving(true);
    try {
      const blob = await shelfPng(strips.map((s) => (full ? s.full : s.spine)), edges);
      const safe = consoleName.replace(/[\\/:*?"<>|]+/g, "-").trim() || "shelf";
      downloadBlob(blob, `${safe} – ${full ? t("cases") : t("spines")}.png`);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  // Load the console's cards (flushing the open template first, so a
  // just-picked picture is on disk).
  useEffect(() => {
    if (!open || !hasSpine()) return;
    let alive = true;
    setCards(null);
    setStrips([]);
    setIdx(0);
    setErr(null);
    (async () => {
      try {
        if (state.dirty) await saveProject(state.project);
        await ensureFontsLoaded();
        const list = await loadOverviewCards(consoleId);
        await Promise.all(packImageSources(list.map((c) => c.card)).map(preloadImage));
        if (alive) setCards(list);
      } catch (e) {
        if (alive) setErr((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, consoleId]);

  // One card at a time through the same hidden stage: let it paint, capture,
  // cut out the spine, move on.
  useEffect(() => {
    if (!cards || idx >= cards.length) return;
    let alive = true;
    const id = requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        if (!alive) return;
        (async () => {
          try {
            const s = stage.current;
            if (!s) throw new Error(t("No card to show."));
            const c = cards[idx];
            const piece = await cut(captureTrim(s, CAPTURE_W));
            if (!alive) return;
            setStrips((a) => [...a, { key: c.key, title: c.gameTitle, ...piece }]);
            setIdx(idx + 1);
          } catch (e) {
            if (alive) setErr((e as Error).message);
          }
        })();
      }),
    );
    return () => {
      alive = false;
      cancelAnimationFrame(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cards, idx]);

  const current = cards?.[idx];
  const rendering = !!cards && idx < cards.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-[96vw] flex-col gap-3">
        <DialogHeader>
          <DialogTitle>{t("Spine preview – {name}", { name: consoleName })}</DialogTitle>
        </DialogHeader>

        {current && (
          <div aria-hidden style={{ position: "fixed", left: -20000, top: 0, opacity: 0 }}>
            <CardStage
              card={current.card}
              width={CAPTURE_W}
              stageRef={(s) => {
                stage.current = s;
              }}
            />
          </div>
        )}

        {!hasSpine() ? (
          <p className="py-6 text-sm text-muted-foreground">
            {t("This format has no spine.")}
          </p>
        ) : err ? (
          <p className="py-6 text-sm text-destructive">{err}</p>
        ) : cards && cards.length === 0 ? (
          <p className="py-6 text-sm text-muted-foreground">
            {t("This console has no games yet.")}
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <label className="flex items-center gap-2">
                <Checkbox checked={full} onCheckedChange={(v) => setFull(!!v)} />
                {t("Whole wraps")}
              </label>
              <label className="flex items-center gap-2">
                <Checkbox checked={edges} onCheckedChange={(v) => setEdges(!!v)} />
                {t("Case edges")}
              </label>
              <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                {(!cards || rendering) && <Loader2 className="size-3.5 animate-spin" />}
                {cards
                  ? t("{n} / {total} cases", { n: strips.length, total: cards.length })
                  : t("loading …")}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={rendering || !strips.length || saving}
                onClick={() => void exportShelf()}
              >
                {saving ? <Loader2 className="animate-spin" /> : <Download />} {t("Export PNG")}
              </Button>
            </div>

            <div className="overflow-x-auto rounded-md border bg-muted/30 p-4">
              <div className="flex w-max items-end">
                {strips.map((s) => (
                  <img
                    key={s.key}
                    src={full ? s.full : s.spine}
                    alt={s.title}
                    title={s.title}
                    draggable={false}
                    className={edges ? "border-l border-black/50 first:border-l-0" : undefined}
                    style={{ height: full ? "46vh" : "62vh", width: "auto", display: "block" }}
                  />
                ))}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
