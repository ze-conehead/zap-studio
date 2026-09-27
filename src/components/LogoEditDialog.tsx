// "Manage logos" ▸ edit one logo with a magic-wand tool: click a stray
// circle, square or background patch and either erase it to transparency
// or flood it with a solid colour, spreading across every connected pixel
// within a colour tolerance.

import { Eraser, Loader2, PaintBucket, Undo2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useT } from "../i18n";
import type { ImageLibrary, LocalLogo } from "../localLogos";
import { floodFill, parseHexColor, toleranceFromPercent, type WandMode } from "../logoEdit";
import { ColorField, SliderField } from "./inspector/fields";

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
  const [mode, setMode] = useState<WandMode>("erase");
  const [color, setColor] = useState("#000000");
  const [tolerance, setTolerance] = useState(20);
  const [history, setHistory] = useState<ImageData[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;
    setDirty(false);
    setHistory([]);
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

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || loading) return;
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
      mode,
      [r, g, b, 255],
    );
    if (painted === 0) return; // clicked outside the image, or nothing matched
    ctx.putImageData(after, 0, 0);
    setHistory((h) => [...h, before]);
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
          {t(
            "Click a spot to erase or fill everything connected to it that's a similar colour — handy for a stray circle, a square logo backing, or an unwanted background patch.",
          )}
        </p>

        <div className="flex gap-2">
          <Button
            variant={mode === "erase" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setMode("erase")}
          >
            <Eraser /> {t("Erase (transparent)")}
          </Button>
          <Button
            variant={mode === "fill" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => setMode("fill")}
          >
            <PaintBucket /> {t("Fill with color")}
          </Button>
        </div>

        {mode === "fill" && <ColorField label={t("Color")} value={color} onChange={setColor} />}

        <SliderField
          label={t("Tolerance {n}%", { n: tolerance })}
          min={0}
          max={100}
          step={1}
          value={tolerance}
          onChange={(v) => setTolerance(Math.round(v))}
        />

        <div
          className="canvas-checker relative flex min-h-[240px] items-center justify-center overflow-hidden rounded-md border"
        >
          {loading && <Loader2 className="absolute size-5 animate-spin text-muted-foreground" />}
          <canvas
            ref={canvasRef}
            onClick={handleClick}
            className="max-h-[45vh] w-full max-w-[360px] cursor-crosshair"
            style={{ imageRendering: "pixelated", visibility: loading ? "hidden" : "visible" }}
          />
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
