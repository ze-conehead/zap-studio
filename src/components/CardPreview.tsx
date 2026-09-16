import type Konva from "konva";
import {
  ChevronLeft,
  ChevronRight,
  FlipHorizontal2,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useT } from "../i18n";
import { packImageSources } from "../demo";
import { exportPng } from "../export";
import { ensureFontsLoaded } from "../fonts";
import { getFormat, type FormatPanel } from "../formats";
import { preloadImage } from "../hooks/useImage";
import { loadOverviewCards, type OverviewCard } from "../overview";
import { saveProject } from "../persist";
import { useStore } from "../store";
import { Card3D, type Card3DHandle } from "./Card3D";
import { captureTrim, CardStage } from "./CardStage";
import type { CanvasHandle } from "./EditorCanvas";

// Capture width for a stepped card (not the one open in the editor).
const RENDER_W = 900;

interface Props {
  canvas: React.MutableRefObject<CanvasHandle | null>;
  // What the tree has selected — decides which card the preview opens on.
  activeGameKey?: string;
  activeConsoleId?: string;
  onClose: () => void;
}

export function CardPreview(props: Props) {
  const panels = getFormat().panels;
  if (panels && panels.length > 1) {
    return <FlatPreview canvas={props.canvas} onClose={props.onClose} panels={panels} />;
  }
  return <CardBrowserPreview {...props} />;
}

// The 3D preview, now a browser: Prev / Next step through every catalogue
// card. Opens on the card being edited; on a console or the global template
// it opens on the first (console) card instead of a blank template.
function CardBrowserPreview({
  canvas,
  activeGameKey,
  activeConsoleId,
  onClose,
}: Props) {
  const t = useT();
  const { state } = useStore();
  const [cards, setCards] = useState<OverviewCard[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [img, setImg] = useState<string | null>(null);
  const [backImg, setBackImg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [holo, setHolo] = useState(false);
  const card3d = useRef<Card3DHandle>(null);
  const offFront = useRef<Konva.Stage | null>(null);
  const offBack = useRef<Konva.Stage | null>(null);
  // Stable so React never re-runs them — the CardStages below stay mounted
  // and only their `card` prop changes as you step.
  const setOffFront = useCallback((s: Konva.Stage | null) => {
    offFront.current = s;
  }, []);
  const setOffBack = useCallback((s: Konva.Stage | null) => {
    offBack.current = s;
  }, []);

  // Load the catalogue once, then pick the starting card.
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        if (state.dirty) await saveProject(state.project);
        await ensureFontsLoaded();
        const list = await loadOverviewCards();
        if (!alive) return;
        let start = list.findIndex((c) => c.key === activeGameKey);
        if (start < 0 && activeConsoleId) {
          start = list.findIndex((c) => c.consoleId === activeConsoleId);
        }
        setCards(list);
        setIdx(Math.max(0, start));
      } catch (e) {
        if (alive) setErr((e as Error).message);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const total = cards?.length ?? 0;
  const current = cards?.[idx];
  const activeIdx = useMemo(
    () => cards?.findIndex((c) => c.key === activeGameKey) ?? -1,
    [cards, activeGameKey],
  );
  // The open design's front is captured off the live editor stage so unsaved
  // edits show; every other face is rendered off-screen through CardStage.
  const showingLive = current != null && idx === activeIdx && activeIdx >= 0;
  // The back face to show: the card's own, else the console template's, else
  // the global one's — resolved in overview.ts.
  const backFace = current?.card.back;
  const hasBack = !!backFace;

  const step = (delta: number) => {
    if (total > 1) setIdx((i) => (i + delta + total) % total);
  };

  // Render the current card's faces to PNGs.
  useEffect(() => {
    if (!current) return;
    let alive = true;
    setImg(null);
    setBackImg(null);
    setErr(null);
    const fail = (e: unknown) => alive && setErr((e as Error).message);

    // Front of the open design → straight off the live editor stage.
    if (showingLive) {
      const w = canvas.current?.getStageWidth() ?? 0;
      const front = canvas.current?.getStage("front");
      if (front && w) {
        exportPng({ stage: front, stageWidth: w, mode: "trim" })
          .then((d) => alive && setImg(d))
          .catch(fail);
      } else {
        setErr(t("No card to show."));
      }
    }

    // Stepped fronts and every back → off-screen CardStage capture.
    void (async () => {
      const srcs = [
        ...packImageSources([current.card]),
        ...(current.card.back?.layers ?? [])
          .filter((l): l is Extract<typeof l, { type: "image" }> => l.type === "image")
          .map((l) => l.src)
          .filter(Boolean),
      ];
      await Promise.all(srcs.map(preloadImage));
      if (!alive) return;
      // Two frames: one for Konva to mount, one for it to paint.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          if (!alive) return;
          try {
            if (!showingLive) {
              if (offFront.current) setImg(captureTrim(offFront.current, RENDER_W));
              else setErr(t("No card to show."));
            }
            if (current.card.back && offBack.current) {
              setBackImg(captureTrim(offBack.current, RENDER_W));
            }
          } catch (e) {
            fail(e);
          }
        }),
      );
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, showingLive, idx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const c = card3d.current;
      if (e.key === "Escape") return onClose();
      if (e.key === "[") return step(-1);
      if (e.key === "]") return step(1);
      if (!c) return;
      if (e.key === "ArrowLeft") c.spin(-45);
      else if (e.key === "ArrowRight") c.spin(45);
      else if (e.key === "f" || e.key === "F") c.flip();
      else if (e.key === "r" || e.key === "R") c.reset();
      else if (e.key === "+" || e.key === "=") c.zoomBy(1.15);
      else if (e.key === "-" || e.key === "_") c.zoomBy(1 / 1.15);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, total]);

  const placeholder = err ?? (cards ? t("rendering …") : t("loading …"));

  return (
    <div className="preview3d-backdrop" onPointerDown={onClose}>
      {/* Off-screen render targets — kept mounted, only the `card` prop
          changes, so there is no remount race on the refs. */}
      {current && (
        <div
          aria-hidden
          style={{ position: "fixed", left: -20000, top: 0, opacity: 0 }}
        >
          {!showingLive && (
            <CardStage card={current.card} width={RENDER_W} stageRef={setOffFront} />
          )}
          {backFace && (
            <CardStage
              card={current.card}
              width={RENDER_W}
              face="back"
              stageRef={setOffBack}
            />
          )}
        </div>
      )}

      <div onPointerDown={(e) => e.stopPropagation()}>
        <Card3D
          ref={card3d}
          front={img}
          back={hasBack ? backImg : null}
          holo={holo}
          placeholder={placeholder}
        />
      </div>

      <div className="preview3d-bar" onPointerDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            title={t("Previous card ([)")}
            disabled={total < 2}
            onClick={() => step(-1)}
          >
            <ChevronLeft />
          </Button>
          <span className="min-w-40 text-center text-sm">
            {current ? (
              <>
                {current.gameTitle}
                <span className="block text-[11px] text-muted-foreground">
                  {current.consoleName}
                  {total > 0 && ` · ${idx + 1} / ${total}`}
                </span>
              </>
            ) : (
              t("loading …")
            )}
          </span>
          <Button
            variant="outline"
            size="icon"
            title={t("Next card (])")}
            disabled={total < 2}
            onClick={() => step(1)}
          >
            <ChevronRight />
          </Button>
        </div>

        <span className="preview3d-sep" />

        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={holo} onCheckedChange={(v) => setHolo(!!v)} />
          {t("Holographic card")}
        </label>
        <span className="preview3d-sep" />
        <Button
          variant="outline"
          size="icon"
          title={t("Zoom out")}
          onClick={() => card3d.current?.zoomBy(1 / 1.2)}
        >
          <ZoomOut />
        </Button>
        <Button
          variant="outline"
          size="icon"
          title={t("Zoom in")}
          onClick={() => card3d.current?.zoomBy(1.2)}
        >
          <ZoomIn />
        </Button>
        <Button variant="outline" size="sm" onClick={() => card3d.current?.flip()}>
          <FlipHorizontal2 /> {t("Flip")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => card3d.current?.reset()}>
          <RotateCcw /> {t("Reset view")}
        </Button>
        <Button variant="outline" size="sm" onClick={onClose}>
          <X /> {t("Close")}
        </Button>
      </div>

      <p className="preview3d-hint" onPointerDown={(e) => e.stopPropagation()}>
        {t("[ ] step cards · drag to rotate · flick to spin · wheel to zoom · F flips, R resets")}
      </p>
    </div>
  );
}

// Multi-panel formats (DVD wrap, J-card) aren't a card you turn over — show
// the flat artboard with the fold lines marked. Off the live editor stage.
function FlatPreview({
  canvas,
  onClose,
  panels,
}: {
  canvas: React.MutableRefObject<CanvasHandle | null>;
  onClose: () => void;
  panels: FormatPanel[];
}) {
  const t = useT();
  const [img, setImg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const w = canvas.current?.getStageWidth() ?? 0;
    const front = canvas.current?.getStage("front");
    if (!front || !w) {
      setErr(t("No card to show."));
      return;
    }
    let cancelled = false;
    exportPng({ stage: front, stageWidth: w, mode: "trim" })
      .then((d) => !cancelled && setImg(d))
      .catch((e) => !cancelled && setErr((e as Error).message));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas]);

  const totalW = panels.reduce((s, p) => s + p.wMM, 0);
  let acc = 0;
  const folds = panels.slice(0, -1).map((p) => {
    acc += p.wMM;
    return (acc / totalW) * 100;
  });

  return (
    <div className="preview3d-backdrop" onPointerDown={onClose}>
      <div className="flat-preview" onPointerDown={(e) => e.stopPropagation()}>
        {img ? (
          <img src={img} alt={t("Card preview")} draggable={false} />
        ) : (
          <div className="preview3d-placeholder">{err ?? t("rendering …")}</div>
        )}
        {folds.map((pct) => (
          <span key={pct} className="flat-preview-fold" style={{ left: `${pct}%` }} />
        ))}
      </div>
      <div className="preview3d-bar" onPointerDown={(e) => e.stopPropagation()}>
        <span className="text-xs text-muted-foreground">{t("Fold lines dashed")}</span>
        <Button variant="outline" size="sm" onClick={onClose}>
          <X /> {t("Close")}
        </Button>
      </div>
    </div>
  );
}
