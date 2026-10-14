import type Konva from "konva";
import { useCallback, useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { scrollDeltaToCenter, visiblePart } from "../viewState";

// A small overview of the open card, in the corner of the canvas, with the
// part that is in view marked — shown while zoomed in far enough that the
// card doesn't fit. Click or drag in it to jump there. The picture is the
// stage itself (without guides and handles), refreshed shortly after any
// change.

const WIDTH = 150; // px
const MAX_HEIGHT = 190;

/** A small picture of what the stage draws — the guides and the selection handles left out. */
function snapshot(stage: Konva.Stage, width: number): string | null {
  if (!stage.width() || !stage.height()) return null;
  const hidden = stage
    .getLayers()
    .filter((l) => l.name() === "guides" || l.getChildren((n) => n.getClassName() === "Transformer").length > 0);
  for (const l of hidden) l.visible(false);
  try {
    return stage.toDataURL({ pixelRatio: width / stage.width() });
  } catch {
    return null; // a tainted canvas (cross-origin picture)
  } finally {
    for (const l of hidden) l.visible(true);
  }
}

export function CanvasMinimap({
  viewport,
  getStage,
  watch,
}: {
  viewport: HTMLDivElement | null;
  getStage: () => Konva.Stage | null;
  // Anything that changes what the card looks like — a new value re-takes the
  // picture. A list of a fixed length.
  watch: readonly unknown[];
}) {
  const t = useT();
  const [thumb, setThumb] = useState<string | null>(null);
  const [part, setPart] = useState<ReturnType<typeof visiblePart> | null>(null);
  const [aspect, setAspect] = useState(1);
  const dragging = useRef(false);

  const boxes = useCallback(() => {
    const st = getStage();
    if (!viewport || !st) return null;
    const c = st.container().getBoundingClientRect();
    const v = viewport.getBoundingClientRect();
    return { card: { left: c.left, top: c.top, width: c.width, height: c.height }, view: { left: v.left, top: v.top, width: v.width, height: v.height } };
  }, [viewport, getStage]);

  // Where the view is on the card: after every scroll and every resize (a
  // zoom resizes the stage).
  const update = useCallback(() => {
    const b = boxes();
    if (!b) return;
    setPart(visiblePart(b.card, b.view));
    setAspect(b.card.height / Math.max(1, b.card.width));
  }, [boxes]);

  useEffect(() => {
    if (!viewport) return;
    update();
    viewport.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(viewport);
    const st = getStage();
    if (st) ro.observe(st.container());
    window.addEventListener("resize", update);
    return () => {
      viewport.removeEventListener("scroll", update);
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [viewport, getStage, update]);

  // The picture, debounced so a drag doesn't re-render it every frame.
  useEffect(() => {
    const id = window.setTimeout(() => {
      const st = getStage();
      if (st) setThumb(snapshot(st, WIDTH * 2));
      update();
    }, 450);
    return () => window.clearTimeout(id);
    // `watch` is a fixed-length list of values, compared one by one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...watch, getStage, update]);

  const jumpTo = (e: React.PointerEvent<HTMLDivElement>) => {
    const b = boxes();
    if (!b || !viewport) return;
    const r = e.currentTarget.getBoundingClientRect();
    const fx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const fy = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    const { dx, dy } = scrollDeltaToCenter(b.card, b.view, fx, fy);
    viewport.scrollLeft += dx;
    viewport.scrollTop += dy;
  };

  if (!part || part.full) return null;
  const h = Math.min(MAX_HEIGHT, WIDTH * aspect);
  const w = h === MAX_HEIGHT ? MAX_HEIGHT / aspect : WIDTH;

  return (
    <div
      className="absolute bottom-5 right-5 z-20 select-none overflow-hidden rounded-md border border-white/20 bg-background/80 shadow-lg backdrop-blur-sm"
      style={{ width: w, height: h, cursor: "pointer", touchAction: "none" }}
      title={t("Minimap — click or drag to move around")}
      data-minimap
      onPointerDown={(e) => {
        e.stopPropagation();
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        jumpTo(e);
      }}
      onPointerMove={(e) => dragging.current && jumpTo(e)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      {thumb && <img src={thumb} alt="" draggable={false} className="pointer-events-none size-full object-fill" />}
      <div
        className="pointer-events-none absolute border-2 border-primary bg-primary/15"
        style={{
          left: `${part.x * 100}%`,
          top: `${part.y * 100}%`,
          width: `${part.w * 100}%`,
          height: `${part.h * 100}%`,
        }}
      />
    </div>
  );
}
