// "Manage logos" ▸ edit one logo: a magic wand (click a stray circle, a
// square backing or an unwanted background patch and either erase it to
// transparency or flood it with a solid colour, spreading across every
// connected pixel within a colour tolerance) and a rectangle tool (drag a
// box and erase exactly that area — no colour matching, for a corner or
// edge the wand can't isolate on its own). The picture can be zoomed
// (wheel, slider or buttons; middle-drag or the scrollbars to move around),
// and a frame always marks where it ends.

import { Eraser, Loader2, PaintBucket, Square, Undo2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { useT } from "../i18n";
import type { ImageLibrary, LocalLogo } from "../localLogos";
import { floodFill, parseHexColor, toleranceFromPercent } from "../logoEdit";
import { ColorField, SliderField } from "./inspector/fields";
import { cn } from "@/lib/utils";

type Tool = "erase" | "fill" | "rect";

const ZOOM_MAX = 8;
const clampZoom = (z: number) => Math.min(ZOOM_MAX, Math.max(1, z));

interface DragRect {
  x0: number; // viewport px (clientX / clientY) — may lie anywhere in the dialog
  y0: number;
  x1: number;
  y1: number;
}

export function LogoEditDialog({
  open,
  onOpenChange,
  logo,
  lib,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logo: LocalLogo;
  lib: ImageLibrary;
}) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [tool, setTool] = useState<Tool>("erase");
  const [color, setColor] = useState("#000000");
  const [tolerance, setTolerance] = useState(20);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [drag, setDrag] = useState<DragRect | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  // Zoom: the picture's width is baseW × zoom; the stage scrolls when it's bigger.
  const [zoom, setZoom] = useState(1);
  const [natural, setNatural] = useState({ w: 1, h: 1 });
  // The stage is in the dialog's portal, which mounts a render later — so the
  // element is kept in state too, for the effect that needs to see it.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageEl, setStageEl] = useState<HTMLDivElement | null>(null);
  const setStage = useCallback((el: HTMLDivElement | null) => {
    stageRef.current = el;
    setStageEl(el);
  }, []);
  // The picture point to keep under the cursor / centre after a zoom, as a
  // fraction of the picture, and where in the stage's view it sits (px).
  const anchorRef = useRef<{ fx: number; fy: number; vx: number; vy: number } | null>(null);
  const panRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const STAGE_PAD = 32;
  const stageH = Math.max(240, Math.round(window.innerHeight * 0.45));
  const baseW = Math.max(
    40,
    Math.min(440, (stageH - 2 * STAGE_PAD) * (natural.w / natural.h)),
  );

  useEffect(() => {
    if (!open) return;
    setDirty(false);
    setHistory([]);
    setDrag(null);
    setZoom(1);
    setLoading(true);
    let alive = true;
    void lib.url(logo.id).then((url) => {
      if (!url || !alive) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!alive || !canvas) return;
        canvas.width = img.naturalWidth || 1;
        canvas.height = img.naturalHeight || 1;
        const ctx = canvas.getContext("2d")!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
        setNatural({ w: canvas.width, h: canvas.height });
        setLoading(false);
      };
      img.src = url;
    });
    return () => {
      alive = false;
    };
  }, [open, logo.id, lib]);

  // Zoom to `next`, keeping the picture point at stage-view (vx, vy) put.
  const zoomTo = (next: number, vx?: number, vy?: number) => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    const z = clampZoom(next);
    if (!stage || !canvas || z === zoom) return;
    const sr = stage.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    const x = vx ?? sr.width / 2;
    const y = vy ?? sr.height / 2;
    const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
    anchorRef.current = {
      fx: clamp01((sr.left + x - cr.left) / cr.width),
      fy: clamp01((sr.top + y - cr.top) / cr.height),
      vx: x,
      vy: y,
    };
    setZoom(z);
  };

  // After the new size is laid out, scroll so the anchor stays under its spot.
  useLayoutEffect(() => {
    const a = anchorRef.current;
    anchorRef.current = null;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!a || !stage || !canvas) return;
    const sr = stage.getBoundingClientRect();
    const cr = canvas.getBoundingClientRect();
    // Where the canvas's top-left sits inside the scrollable content.
    const contentLeft = cr.left - sr.left + stage.scrollLeft;
    const contentTop = cr.top - sr.top + stage.scrollTop;
    stage.scrollLeft = contentLeft + a.fx * cr.width - a.vx;
    stage.scrollTop = contentTop + a.fy * cr.height - a.vy;
  }, [zoom]);

  // The wheel zooms (a native, non-passive listener so the page doesn't
  // scroll); re-attached with each zoom so it always sees the current one.
  useEffect(() => {
    const stage = stageEl;
    if (!open || !stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const sr = stage.getBoundingClientRect();
      zoomTo(zoom * Math.exp(-e.deltaY * 0.0015), e.clientX - sr.left, e.clientY - sr.top);
    };
    stage.addEventListener("wheel", onWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onWheel);
    // zoomTo is rebuilt each render and only reads `zoom`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, zoom, stageEl]);

  const undo = () => {
    const canvas = canvasRef.current;
    if (!canvas || history.length === 0) return;
    const ctx = canvas.getContext("2d")!;
    ctx.putImageData(history[history.length - 1], 0, 0);
    setHistory((h) => h.slice(0, -1));
    setDirty(history.length > 1);
  };

  // Magic wand: click a spot, flood-fill everything connected to it that's
  // a similar colour.
  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || loading || tool === "rect") return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;

    const ctx = canvas.getContext("2d")!;
    const before = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const after = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const [r, g, b] = parseHexColor(color);
    const painted = floodFill(
      after.data,
      canvas.width,
      canvas.height,
      x,
      y,
      toleranceFromPercent(tolerance),
      tool,
      [r, g, b, 255],
    );
    if (painted === 0) return; // clicked outside the image, or nothing matched
    ctx.putImageData(after, 0, 0);
    setHistory((h) => [...h, before]);
    setDirty(true);
  };

  // Rectangle: drag a box, erase exactly that area on release — no colour
  // matching, so it also clears a corner/edge blended into its surroundings
  // that the wand can't isolate. The whole dialog is the drag surface, not
  // just the picture or its margin: a box can start anywhere (outside the
  // logo, past its edge) and only the part over the picture is erased.
  // Pointer capture keeps it tracking, clamped to the dialog, when the cursor
  // leaves it.
  const MIN_DRAG_PX = 3;
  const contentRef = useRef<HTMLDivElement>(null);

  const point = (e: React.PointerEvent<HTMLElement>) => {
    const r = contentRef.current?.getBoundingClientRect();
    return r
      ? {
          x: Math.min(Math.max(e.clientX, r.left), r.right),
          y: Math.min(Math.max(e.clientY, r.top), r.bottom),
        }
      : { x: e.clientX, y: e.clientY };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Middle button over the stage: move the zoomed picture around.
    if (e.button === 1 && stageRef.current?.contains(e.target as Node)) {
      e.preventDefault();
      e.currentTarget.setPointerCapture(e.pointerId);
      panRef.current = {
        x: e.clientX,
        y: e.clientY,
        left: stageRef.current.scrollLeft,
        top: stageRef.current.scrollTop,
      };
      return;
    }
    if (tool !== "rect" || loading || e.button !== 0 || !canvasRef.current) return;
    // Controls keep working as usual.
    if ((e.target as HTMLElement).closest("button, input, textarea, select, [role=slider], [role=combobox], label")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = point(e);
    dragStartRef.current = { x, y };
    setDrag({ x0: x, y0: y, x1: x, y1: y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pan = panRef.current;
    if (pan && stageRef.current) {
      stageRef.current.scrollLeft = pan.left - (e.clientX - pan.x);
      stageRef.current.scrollTop = pan.top - (e.clientY - pan.y);
      return;
    }
    if (!dragStartRef.current) return;
    const { x, y } = point(e);
    setDrag({ x0: dragStartRef.current.x, y0: dragStartRef.current.y, x1: x, y1: y });
  };

  const finishDrag = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (e?.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (panRef.current) {
      panRef.current = null;
      return;
    }
    const canvas = canvasRef.current;
    const start = dragStartRef.current;
    dragStartRef.current = null;
    setDrag(null);
    if (!canvas || !start || !drag) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    if (Math.abs(drag.x1 - drag.x0) < MIN_DRAG_PX || Math.abs(drag.y1 - drag.y0) < MIN_DRAG_PX) {
      return; // a stray click/tiny nudge, not a real box
    }
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    // Only the part of the box that lies over the picture.
    const cx0 = Math.max(0, Math.round((Math.min(drag.x0, drag.x1) - rect.left) * scaleX));
    const cy0 = Math.max(0, Math.round((Math.min(drag.y0, drag.y1) - rect.top) * scaleY));
    const cx1 = Math.min(canvas.width, Math.round((Math.max(drag.x0, drag.x1) - rect.left) * scaleX));
    const cy1 = Math.min(canvas.height, Math.round((Math.max(drag.y0, drag.y1) - rect.top) * scaleY));
    const w = cx1 - cx0;
    const h = cy1 - cy0;
    if (w <= 0 || h <= 0) return;

    const ctx = canvas.getContext("2d")!;
    const before = ctx.getImageData(0, 0, canvas.width, canvas.height);
    ctx.clearRect(cx0, cy0, w, h);
    setHistory((hist) => [...hist, before]);
    setDirty(true);
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setSaving(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png"),
      );
      await lib.replace(logo.id, blob);
      onOpenChange(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent
        ref={contentRef}
        className={cn("flex max-w-xl flex-col gap-3", tool === "rect" && "cursor-crosshair select-none")}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <DialogHeader>
          <DialogTitle className="truncate">{t("Edit “{name}”", { name: logo.name })}</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          {tool === "rect"
            ? t("Drag a box over the area to erase — exactly that rectangle, no colour matching.")
            : t(
                "Click a spot to erase or fill everything connected to it that's a similar colour — handy for a stray circle, a square logo backing, or an unwanted background patch.",
              )}
        </p>

        <div className="flex gap-2">
          <Button
            variant={tool === "erase" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setTool("erase")}
          >
            <Eraser /> {t("Erase (transparent)")}
          </Button>
          <Button
            variant={tool === "fill" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setTool("fill")}
          >
            <PaintBucket /> {t("Fill with color")}
          </Button>
          <Button
            variant={tool === "rect" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setTool("rect")}
          >
            <Square /> {t("Rectangle")}
          </Button>
        </div>

        {tool === "fill" && <ColorField label={t("Color")} value={color} onChange={setColor} />}

        {tool !== "rect" && (
          <SliderField
            label={t("Tolerance {n}%", { n: tolerance })}
            min={0}
            max={100}
            step={1}
            value={tolerance}
            onChange={(v) => setTolerance(Math.round(v))}
          />
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-7 shrink-0"
            title={t("Zoom out")}
            disabled={zoom <= 1}
            onClick={() => zoomTo(zoom / 1.5)}
          >
            <ZoomOut />
          </Button>
          <div className="min-w-0 flex-1">
            <Slider
              min={1}
              max={ZOOM_MAX}
              step={0.05}
              value={[zoom]}
              onValueChange={([v]) => zoomTo(v)}
              aria-label={t("Zoom")}
            />
          </div>
          <Button
            variant="outline"
            size="icon"
            className="size-7 shrink-0"
            title={t("Zoom in")}
            disabled={zoom >= ZOOM_MAX}
            onClick={() => zoomTo(zoom * 1.5)}
          >
            <ZoomIn />
          </Button>
          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button variant="ghost" size="sm" className="h-7 px-2" disabled={zoom === 1} onClick={() => zoomTo(1)}>
            {t("Fit")}
          </Button>
        </div>

        <div
          ref={setStage}
          className="canvas-checker relative overflow-auto rounded-md border"
          style={{ height: stageH }}
          title={t("Scroll to zoom, middle-drag or the scrollbars to move around")}
        >
          {loading && <Loader2 className="absolute left-1/2 top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 animate-spin text-muted-foreground" />}
          {/* m-auto centres the picture while it fits and still lets it scroll once it doesn't */}
          <div
            className="m-auto w-max"
            style={{ padding: STAGE_PAD, visibility: loading ? "hidden" : "visible", minHeight: "100%", display: "grid", placeItems: "center" }}
          >
            <canvas
              ref={canvasRef}
              onClick={handleClick}
              className="block cursor-crosshair touch-none outline outline-2 outline-primary/70"
              style={{
                imageRendering: "pixelated",
                width: baseW * zoom,
                height: (baseW * zoom * natural.h) / natural.w,
                maxWidth: "none",
              }}
            />
          </div>
        </div>
        {drag &&
          // Portalled to <body>: the dialog is transformed, which would make
          // `fixed` relative to it instead of the viewport.
          createPortal(
            <div
              className="pointer-events-none fixed z-[60] border-2 border-primary bg-primary/20"
              style={{
                left: Math.min(drag.x0, drag.x1),
                top: Math.min(drag.y0, drag.y1),
                width: Math.abs(drag.x1 - drag.x0),
                height: Math.abs(drag.y1 - drag.y0),
              }}
            />,
            document.body,
          )}

        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" disabled={history.length === 0} onClick={undo}>
            <Undo2 /> {t("Undo")}
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              {t("Cancel")}
            </Button>
            <Button disabled={!dirty || saving} onClick={() => void save()}>
              {saving && <Loader2 className="animate-spin" />} {t("Save")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
