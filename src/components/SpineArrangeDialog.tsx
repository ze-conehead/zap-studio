import { RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useT } from "../i18n";
import { spinePan, spinePlacement, spineRect, spineZoomAt, spineZoomOf, SPINE_ZOOM_MAX } from "../spine";
import type { ImageLayer } from "../types";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { SliderField, type Patch } from "./inspector/fields";

// The picture of the "Spine background" laid out on the strip of all the
// console's spines side by side: drag it to move it, wheel (or slider) to
// resize it. The thin lines are the cuts between two cases. What you see is
// what each card's spine panel gets — see src/spine.ts.
export function SpineArrangeDialog({
  open,
  onOpenChange,
  layer,
  count,
  patch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  layer: ImageLayer;
  count: number;
  patch: Patch;
}) {
  const t = useT();
  const rect = spineRect();
  const drag = useRef<{ x: number; y: number; focus: { x: number; y: number }; w: number; last?: { x: number; y: number } } | null>(null);
  // The latest values, for the wheel listener and the closing history entry.
  const live = useRef({ layer, count });
  live.current = { layer, count };
  const [dragging, setDragging] = useState(false);
  const idle = useRef<number>(0);

  // Wheel zoom needs a non-passive listener to stop the page from scrolling.
  // It only exists while the dialog is open, hence the effect keyed on `open`
  // and the box being mounted.
  const [box, setBox] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!box || !rect) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { layer: l, count: n } = live.current;
      const b = box.getBoundingClientRect();
      const k = (n * rect.w) / b.width;
      const next = spineZoomAt(
        l,
        n,
        rect,
        spineZoomOf(l) * Math.exp(-e.deltaY * 0.0015),
        (e.clientX - b.left) * k,
        (e.clientY - b.top) * k,
      );
      patch(next, false);
      // One undo step per wheel gesture, not per tick.
      window.clearTimeout(idle.current);
      idle.current = window.setTimeout(() => {
        const cur = live.current.layer;
        patch({ spineZoom: cur.spineZoom, spineFocus: cur.spineFocus }, true);
      }, 250);
    };
    box.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      box.removeEventListener("wheel", onWheel);
      window.clearTimeout(idle.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [box]);

  if (!rect) return null;
  const stripW = count * rect.w;
  const place = spinePlacement(layer, count, rect);
  const pct = (v: number, of: number) => `${(v / of) * 100}%`;
  const focus = layer.spineFocus ?? { x: 0.5, y: 0.5 };
  const zoom = spineZoomOf(layer);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[92vh] max-w-[96vw] flex-col gap-3">
        <DialogHeader>
          <DialogTitle>{t("Arrange across all spines")}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {t("Drag the picture to move it, scroll to resize it. The lines mark where one case ends and the next begins.")}
        </p>

        <div className="flex justify-center">
          <div
            ref={setBox}
            className="relative overflow-hidden rounded-md border bg-muted/40 select-none"
            style={{
              aspectRatio: `${stripW} / ${rect.h}`,
              width: `min(100%, calc(60vh * ${stripW / rect.h}))`,
              cursor: dragging ? "grabbing" : "grab",
              touchAction: "none",
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.currentTarget.setPointerCapture(e.pointerId);
              drag.current = { x: e.clientX, y: e.clientY, focus, w: e.currentTarget.getBoundingClientRect().width };
              setDragging(true);
            }}
            onPointerMove={(e) => {
              const d = drag.current;
              if (!d) return;
              const k = stripW / d.w;
              d.last = spinePan(layer, count, rect, d.focus, (e.clientX - d.x) * k, (e.clientY - d.y) * k);
              patch({ spineFocus: d.last }, false);
            }}
            onPointerUp={() => {
              const d = drag.current;
              if (!d) return;
              drag.current = null;
              setDragging(false);
              // Close the drag as one history step.
              if (d.last) patch({ spineFocus: d.last }, true);
            }}
          >
            <img
              src={layer.src}
              alt=""
              draggable={false}
              className="pointer-events-none absolute max-w-none"
              style={{
                left: pct(place.left, stripW),
                top: pct(place.top, rect.h),
                width: pct(place.w, stripW),
                height: pct(place.h, rect.h),
                opacity: layer.opacity,
              }}
            />
            {Array.from({ length: count - 1 }, (_, i) => (
              <span
                key={i}
                className="pointer-events-none absolute inset-y-0 w-px bg-black/60 shadow-[0_0_0_1px_rgba(255,255,255,0.35)]"
                style={{ left: `${((i + 1) / count) * 100}%` }}
              />
            ))}
          </div>
        </div>

        <div className="flex items-end gap-3">
          <div className="min-w-0 flex-1">
            <SliderField
              label={t("Size {n}%", { n: Math.round(zoom * 100) })}
              min={1}
              max={SPINE_ZOOM_MAX}
              step={0.01}
              value={zoom}
              onChange={(z, done) =>
                patch(spineZoomAt(layer, count, rect, z, stripW / 2, rect.h / 2), done)
              }
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={zoom === 1 && focus.x === 0.5 && focus.y === 0.5}
            onClick={() => patch({ spineZoom: undefined, spineFocus: undefined }, true)}
          >
            <RotateCcw /> {t("Reset")}
          </Button>
          <Button size="sm" onClick={() => onOpenChange(false)}>
            {t("Done")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
