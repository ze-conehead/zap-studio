// "Manage logos" ▸ edit one logo: a magic wand (click a stray circle, a
// square backing or an unwanted background patch and either erase it to
// transparency or flood it with a solid colour, spreading across every
// connected pixel within a colour tolerance) and a rectangle tool (drag a
// box and erase exactly that area — no colour matching, for a corner or
// edge the wand can't isolate on its own).

import { Eraser, Loader2, PaintBucket, Square, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "../i18n";
import type { ImageLibrary, LocalLogo } from "../localLogos";
import { floodFill, parseHexColor, toleranceFromPercent } from "../logoEdit";
import { ColorField, SliderField } from "./inspector/fields";

type Tool = "erase" | "fill" | "rect";

interface DragRect {
  x0: number; // CSS px, relative to the canvas element
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

  useEffect(() => {
    if (!open) return;
    setDirty(false);
    setHistory([]);
    setDrag(null);
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
        setLoading(false);
      };
      img.src = url;
    });
    return () => {
      alive = false;
    };
  }, [open, logo.id, lib]);

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
  // that the wand can't isolate. Uses pointer capture so the drag keeps
  // tracking (and clamps to the canvas) even once the cursor slips outside
  // the canvas's box — which happens constantly when dragging near the
  // transparent padding around a logo, right at the canvas's own edge.
  const MIN_DRAG_CSS_PX = 3;

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (tool !== "rect" || loading) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
    dragStartRef.current = { x, y };
    setDrag({ x0: x, y0: y, x1: x, y1: y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragStartRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - rect.left, 0), rect.width);
    const y = Math.min(Math.max(e.clientY - rect.top, 0), rect.height);
    setDrag({ x0: dragStartRef.current.x, y0: dragStartRef.current.y, x1: x, y1: y });
  };

  const finishDrag = (e?: React.PointerEvent<HTMLCanvasElement>) => {
    if (e?.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    const canvas = canvasRef.current;
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (!canvas || !start || !drag) {
      setDrag(null);
      return;
    }
    setDrag(null);
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    if (Math.abs(drag.x1 - drag.x0) < MIN_DRAG_CSS_PX || Math.abs(drag.y1 - drag.y0) < MIN_DRAG_CSS_PX) {
      return; // a stray click/tiny nudge, not a real box
    }
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const cx0 = Math.round(Math.min(drag.x0, drag.x1) * scaleX);
    const cy0 = Math.round(Math.min(drag.y0, drag.y1) * scaleY);
    const cx1 = Math.round(Math.max(drag.x0, drag.x1) * scaleX);
    const cy1 = Math.round(Math.max(drag.y0, drag.y1) * scaleY);
    const w = Math.min(canvas.width, cx1) - cx0;
    const h = Math.min(canvas.height, cy1) - cy0;
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
      <DialogContent className="flex max-w-xl flex-col gap-3">
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

        <div className="canvas-checker relative flex min-h-[240px] items-center justify-center overflow-hidden rounded-md border">
          {loading && <Loader2 className="absolute size-5 animate-spin text-muted-foreground" />}
          <div
            className="relative w-full max-w-[360px]"
            style={{ visibility: loading ? "hidden" : "visible" }}
          >
            <canvas
              ref={canvasRef}
              onClick={handleClick}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={finishDrag}
              onPointerCancel={finishDrag}
              className="block max-h-[45vh] w-full cursor-crosshair touch-none"
              style={{ imageRendering: "pixelated" }}
            />
            {drag && (
              <div
                className="pointer-events-none absolute border-2 border-primary bg-primary/20"
                style={{
                  left: Math.min(drag.x0, drag.x1),
                  top: Math.min(drag.y0, drag.y1),
                  width: Math.abs(drag.x1 - drag.x0),
                  height: Math.abs(drag.y1 - drag.y0),
                }}
              />
            )}
          </div>
        </div>

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
